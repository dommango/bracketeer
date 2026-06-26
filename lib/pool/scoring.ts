// Pool scoring service: turns stored picks + the tournament answer key into
// per-entry ScoreBreakdown rows and a ranked leaderboard. The actual point math
// lives in lib/scoring (byte-compatible with the original tool); this layer is
// the DB glue.

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { scorePicks, type ScoringConfig, DEFAULT_SCORING } from "@/lib/scoring/score";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { emptyPicks, type Results } from "@/lib/scoring/types";
import { snapshotsToWrite, type SnapshotPoint } from "@/lib/pool/movers";
import { assignRanks } from "@/lib/pool/rank";
import { scoreMd3Pool, scoreMd3Entry, scoreStandaloneMd3 } from "@/lib/pool/md3-scoring";
import type { Md3Tiebreak } from "@/lib/challenge/md3-tiebreak";

type Db = Prisma.TransactionClient;

// Coerce the tournament's stored JSON answer key into a Results object.
export function asResults(officialResults: unknown): Results {
  const base: Results = { ...emptyPicks(), finalGoals: null };
  if (!officialResults || typeof officialResults !== "object") return base;
  return { ...base, ...(officialResults as Partial<Results>) };
}

export function asScoringConfig(scoringConfig: unknown): ScoringConfig {
  if (!scoringConfig || typeof scoringConfig !== "object") return DEFAULT_SCORING;
  return { ...DEFAULT_SCORING, ...(scoringConfig as Record<string, number>) };
}

// Recompute every entry in a pool against its tournament answer key, writing
// ScoreBreakdown rows. Returns the ranked leaderboard.
//
// Runs in ONE transaction holding a per-pool advisory lock: concurrent
// recomputes (cron poll vs. live import vs. pick save, possibly in separate
// processes) would otherwise race captureSnapshots' read-then-write into
// duplicate snapshot rows and serve a leaderboard mixing two half-applied
// recomputes. The lock serializes them; the transaction makes the breakdown
// cache flip atomically instead of entry-by-entry.
export async function recomputePool(poolId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${poolId}))`;

      const pool = await tx.pool.findUniqueOrThrow({
        where: { id: poolId },
        include: { tournament: true },
      });

      // Match Day Pickem scores against live per-match Result rows, not the answer
      // key — its own engine. Every other format uses the parity oracle. MD3 is now
      // challenge-only (no new MD3 pools); this pool arm is a defensive backstop for
      // any not-yet-migrated MD3 pool and can be removed once the prod migration has
      // run (scripts/migrate-md3-pools-to-challenge.ts).
      if (pool.format === "MATCH_DAY_3_PICKEM") {
        await scoreMd3Pool(tx, poolId, pool.tournamentId);
      } else {
        const answer = asResults(pool.tournament.officialResults);
        const cfg = asScoringConfig(pool.tournament.scoringConfig);

        const entries = await tx.entry.findMany({
          where: { poolId },
          include: { picks: true },
        });

        await scoreEntryBreakdowns(tx, entries, answer, cfg);
      }

      const leaderboard = await getLeaderboard(poolId, tx);
      await captureSnapshots(poolId, leaderboard, tx);
      return leaderboard;
    },
    { timeout: 30_000 },
  );
}

// Score a batch of entries (with their picks loaded) against an answer key and
// upsert each ScoreBreakdown. Pool-independent — shared by recomputePool, the
// per-entry recompute, and the standalone recompute. Writes the cache only; it
// never touches snapshots (those are a pool concern).
type ScorableEntry = { id: string; picks: Parameters<typeof pickRowsToSubmission>[0] };

async function scoreEntryBreakdowns(
  tx: Db,
  entries: ScorableEntry[],
  answer: Results,
  cfg: ScoringConfig,
): Promise<void> {
  for (const entry of entries) {
    const sub = pickRowsToSubmission(entry.picks);
    const { total, breakdown } = scorePicks(sub.picks, answer, cfg);
    await tx.scoreBreakdown.upsert({
      where: { entryId: entry.id },
      update: { totalPoints: total, byCategory: breakdown, computedAt: new Date() },
      create: { entryId: entry.id, totalPoints: total, byCategory: breakdown },
    });
  }
}

// Recompute one entry against its own tournament's answer key. For standalone
// brackets (solo save, Challenge toggle) where there's no pool to recompute and
// no snapshot to capture. Scores against the entry's tournament directly, so it
// works whether the entry is in a pool or stands alone.
//
// Match Day 3 entries are the exception: they score against live Result rows via
// scoreMd3Pool (the parity oracle would read their pick rows as an empty bracket
// and write 0). MD3 is pool-only, so this rescores that whole MD3 pool's
// breakdowns — still without snapshots or the pool advisory lock (idempotent
// upserts, so a concurrent recomputePool can't corrupt it).
export async function recomputeEntry(entryId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.entry.findUniqueOrThrow({
      where: { id: entryId },
      include: { picks: true, tournament: { select: { officialResults: true, scoringConfig: true } } },
    });
    // Match Day Pickem entries score against live Result rows via their own engine;
    // the parity oracle would decode their match_day_3 pick rows as an empty bracket
    // (0 pts). Challenge entries are standalone (poolId null) and rescore just
    // themselves. The pooled arm is a defensive backstop for any not-yet-migrated
    // MD3 pool; removable once the prod migration has run.
    if (entry.format === "MATCH_DAY_3_PICKEM") {
      if (entry.poolId) await scoreMd3Pool(tx, entry.poolId, entry.tournamentId);
      else await scoreMd3Entry(tx, entry.id, entry.tournamentId);
      return;
    }
    const answer = asResults(entry.tournament.officialResults);
    const cfg = asScoringConfig(entry.tournament.scoringConfig);
    await scoreEntryBreakdowns(tx, [entry], answer, cfg);
  });
}

// Recompute every standalone entry (poolId == null) in a tournament against its
// answer key. Run when results land so Challenge/solo brackets rescore alongside
// the pools. No snapshots — standalone brackets carry no mover history.
export async function recomputeStandalone(tournamentId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { officialResults: true, scoringConfig: true },
    });
    const answer = asResults(t.officialResults);
    const cfg = asScoringConfig(t.scoringConfig);
    const entries = await tx.entry.findMany({
      where: { tournamentId, poolId: null },
      include: { picks: true },
    });
    // MD3 standalone entries score against live results, not the answer key (the
    // oracle would read their pick rows as an empty bracket → 0). Split them out.
    const bracketEntries = entries.filter((e) => e.format !== "MATCH_DAY_3_PICKEM");
    const hasMd3 = entries.some((e) => e.format === "MATCH_DAY_3_PICKEM");
    await scoreEntryBreakdowns(tx, bracketEntries, answer, cfg);
    if (hasMd3) await scoreStandaloneMd3(tx, tournamentId);
    return entries.length;
  });
}

// Persist a point/rank snapshot per entry whose standing changed since its last
// snapshot. Deduped so identical recomputes don't accumulate rows; the dedup
// decision itself is the pure snapshotsToWrite (unit-tested in movers.test.ts).
async function captureSnapshots(
  poolId: string,
  leaderboard: LeaderboardRow[],
  db: Db = prisma,
): Promise<void> {
  const existing = await db.scoreSnapshot.findMany({
    where: { poolId },
    orderBy: { capturedAt: "asc" },
    select: { entryId: true, totalPoints: true, rank: true },
  });
  const latestByEntry = new Map<string, SnapshotPoint>();
  for (const s of existing) latestByEntry.set(s.entryId, s);

  const toWrite = snapshotsToWrite(
    latestByEntry,
    leaderboard.map((r) => ({ entryId: r.entryId, total: r.total, rank: r.rank })),
  );
  if (toWrite.length === 0) return;

  await db.scoreSnapshot.createMany({
    data: toWrite.map((p) => ({
      poolId,
      entryId: p.entryId,
      totalPoints: p.totalPoints,
      rank: p.rank,
    })),
  });
}

export interface LeaderboardRow {
  rank: number;
  entryId: string;
  label: string;
  userId: string | null;
  total: number;
  breakdown: unknown;
  tiebreak: string | null;
  // Display-only: points this entry would gain if live knockout matches ended
  // at their current score (see lib/pool/projected.ts). Absent when nothing is live.
  projected?: number;
  // Decisive ranking tiebreak for the Match Day Pickem board, derived from the
  // cached per-pick scoring (see lib/challenge/md3-tiebreak.ts). Set only for MD3
  // rows; absent on full-bracket/knockout rows, which keep total-only ranking.
  md3Tiebreak?: Md3Tiebreak;
}

// Read the cached leaderboard for a pool, ranked by total desc then label.
// (Tiebreak handling is intentionally simple for the MVP — surfaced but not
// auto-applied; the organizer breaks ties using the final-goals tiebreak.)
export async function getLeaderboard(poolId: string, db: Db = prisma): Promise<LeaderboardRow[]> {
  const entries = await db.entry.findMany({
    where: { poolId },
    include: { breakdown: true },
  });

  const rows = entries
    .map((e) => ({
      entryId: e.id,
      label: e.label,
      userId: e.userId,
      total: e.breakdown?.totalPoints ?? 0,
      breakdown: e.breakdown?.byCategory ?? null,
      tiebreak: e.tiebreak,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  // Tied entries share a place (standard competition ranking); label only orders
  // the display within a tie, it does not break the rank.
  return assignRanks(rows);
}
