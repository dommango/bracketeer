// Pool scoring service: turns stored picks + the tournament answer key into
// per-entry ScoreBreakdown rows and a ranked leaderboard. The actual point math
// lives in lib/scoring (byte-compatible with the original tool); this layer is
// the DB glue.

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { type ScoringConfig, DEFAULT_SCORING } from "@/lib/scoring/score";
import { emptyPicks, type Results } from "@/lib/scoring/types";
import { snapshotsToWrite, type SnapshotPoint } from "@/lib/pool/movers";
import { assignRanksByCompare } from "@/lib/pool/rank";
import { gameFor } from "@/lib/games/registry";
import type { ScorableGameEntry, ScoringContext, ScoredEntry } from "@/lib/games/types";
import type { PoolFormat } from "@/lib/pool/manage";
import { parseMd3Tiebreak, type Md3Tiebreak } from "@/lib/challenge/md3-tiebreak";

type Db = Prisma.TransactionClient;

// Build the format-independent scoring context once per recompute.
function scoringContext(
  tournamentId: string,
  officialResults: unknown,
  scoringConfig: unknown,
): ScoringContext {
  return {
    tournamentId,
    answer: asResults(officialResults),
    cfg: asScoringConfig(scoringConfig),
    now: new Date(),
  };
}

// Upsert the ScoreBreakdown rows a module computed. perPick is written ONLY when
// the module supplied it (MD3) — bracket rows carry no perPick, exactly as before.
async function upsertScored(tx: Db, scored: ScoredEntry[]): Promise<void> {
  for (const s of scored) {
    const byCategory = s.byCategory as Prisma.InputJsonValue;
    await tx.scoreBreakdown.upsert({
      where: { entryId: s.entryId },
      update: {
        totalPoints: s.totalPoints,
        byCategory,
        ...(s.perPick ? { perPick: s.perPick } : {}),
        computedAt: new Date(),
      },
      create: {
        entryId: s.entryId,
        totalPoints: s.totalPoints,
        byCategory,
        ...(s.perPick ? { perPick: s.perPick } : {}),
      },
    });
  }
}

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
// `captureSnapshots` defaults on; pass false for an administrative recompute that
// isn't a result landing (e.g. a scoring-rule cutover) so the change doesn't
// surface as a "top mover" as though someone gained points from a match.
export async function recomputePool(
  poolId: string,
  opts: { captureSnapshots?: boolean } = {},
) {
  const shouldSnapshot = opts.captureSnapshots ?? true;
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${poolId}))`;

      const pool = await tx.pool.findUniqueOrThrow({
        where: { id: poolId },
        include: { tournament: true },
      });

      // One pool has one format, so one module scores every entry. The module
      // decides how (the parity oracle for bracket/knockout, live Result rows for
      // Match Day Pickem); the orchestrator just owns the transaction + upsert.
      const entries = await tx.entry.findMany({
        where: { poolId },
        include: { picks: true },
      });
      const ctx = scoringContext(
        pool.tournamentId,
        pool.tournament.officialResults,
        pool.tournament.scoringConfig,
      );
      const scored = await gameFor(pool.format as PoolFormat).scoreEntries(
        tx,
        entries as ScorableGameEntry[],
        ctx,
      );
      await upsertScored(tx, scored);

      const leaderboard = await getLeaderboard(poolId, tx, pool.format as PoolFormat);
      if (shouldSnapshot) await captureSnapshots(poolId, leaderboard, tx);
      return leaderboard;
    },
    { timeout: 30_000 },
  );
}

// Recompute one entry against its own tournament. Used wherever a single bracket
// is saved without a full pool rescore — standalone brackets (solo save, Challenge
// toggle) and pooled knockout brackets edited via the Challenge picks switcher
// (safe pre-lock, when an editable bracket always scores 0). The entry's
// GameModule decides how to score it — the bracket oracle, or
// (for Match Day Pickem) live Result rows — so this works for every format without
// a fork. No snapshots or pool advisory lock (idempotent upserts, so a concurrent
// recomputePool can't corrupt it).
export async function recomputeEntry(entryId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entry = await tx.entry.findUniqueOrThrow({
      where: { id: entryId },
      include: { picks: true, tournament: { select: { officialResults: true, scoringConfig: true } } },
    });
    const ctx = scoringContext(
      entry.tournamentId,
      entry.tournament.officialResults,
      entry.tournament.scoringConfig,
    );
    const scored = await gameFor(entry.format as PoolFormat).scoreEntries(
      tx,
      [entry] as ScorableGameEntry[],
      ctx,
    );
    await upsertScored(tx, scored);
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
    const ctx = scoringContext(tournamentId, t.officialResults, t.scoringConfig);
    const entries = await tx.entry.findMany({
      where: { tournamentId, poolId: null },
      include: { picks: true },
    });
    // Standalone entries can mix formats (bracket challenge + Match Day Pickem), so
    // group by format and let each game's module score its own — the bracket oracle
    // for bracket/knockout, live Result rows for MD3.
    const byFormat = new Map<PoolFormat, ScorableGameEntry[]>();
    for (const e of entries) {
      const format = e.format as PoolFormat;
      const group = byFormat.get(format) ?? [];
      group.push(e as ScorableGameEntry);
      byFormat.set(format, group);
    }
    for (const [format, group] of byFormat) {
      const scored = await gameFor(format).scoreEntries(tx, group, ctx);
      await upsertScored(tx, scored);
    }
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
export async function getLeaderboard(
  poolId: string,
  db: Db = prisma,
  format?: PoolFormat,
): Promise<LeaderboardRow[]> {
  // The game module decides the ranking, so we need the pool's format. Callers
  // that already hold the pool (recomputePool) pass it in to avoid a second
  // round-trip; otherwise look it up. A missing pool yields an empty board, as
  // the pre-module version did (it simply found no entries).
  let fmt = format;
  if (!fmt) {
    const pool = await db.pool.findUnique({ where: { id: poolId }, select: { format: true } });
    if (!pool) return [];
    fmt = pool.format as PoolFormat;
  }

  const entries = await db.entry.findMany({ where: { poolId }, include: { breakdown: true } });

  const rows = entries.map((e) => ({
    entryId: e.id,
    label: e.label,
    userId: e.userId,
    total: e.breakdown?.totalPoints ?? 0,
    breakdown: e.breakdown?.byCategory ?? null,
    tiebreak: e.tiebreak,
    // Quality-cascade tiebreak cached at scoring time; undefined for bracket rows
    // and older MD3 rows, so they fall back to total-only ranking.
    md3Tiebreak: parseMd3Tiebreak(e.breakdown?.byCategory),
  }));

  // Rank through the pool's game module: bracket/knockout rank by total alone,
  // Match Day Pickem adds its decisive quality tiebreak. compareForRank is
  // label-free, so tied entries share a place; label only orders display.
  const cmp = gameFor(fmt).compareForRank;
  const sorted = [...rows].sort((a, b) => cmp(a, b) || a.label.localeCompare(b.label));
  return assignRanksByCompare(sorted, cmp);
}
