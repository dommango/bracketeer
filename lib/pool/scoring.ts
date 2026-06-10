// Pool scoring service: turns stored picks + the tournament answer key into
// per-entry ScoreBreakdown rows and a ranked leaderboard. The actual point math
// lives in lib/scoring (byte-compatible with the original tool); this layer is
// the DB glue.

import { prisma } from "@/lib/db";
import { scorePicks, type ScoringConfig, DEFAULT_SCORING } from "@/lib/scoring/score";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { emptyPicks, type Results } from "@/lib/scoring/types";

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
export async function recomputePool(poolId: string) {
  const pool = await prisma.pool.findUniqueOrThrow({
    where: { id: poolId },
    include: { tournament: true },
  });
  const answer = asResults(pool.tournament.officialResults);
  const cfg = asScoringConfig(pool.tournament.scoringConfig);

  const entries = await prisma.entry.findMany({
    where: { poolId },
    include: { picks: true },
  });

  for (const entry of entries) {
    const sub = pickRowsToSubmission(entry.picks);
    const { total, breakdown } = scorePicks(sub.picks, answer, cfg);
    await prisma.scoreBreakdown.upsert({
      where: { entryId: entry.id },
      update: { totalPoints: total, byCategory: breakdown, computedAt: new Date() },
      create: { entryId: entry.id, totalPoints: total, byCategory: breakdown },
    });
  }

  const leaderboard = await getLeaderboard(poolId);

  // Append a point-in-time snapshot per entry (single batch timestamp) so the
  // trend + "biggest mover" views have history. Appended, never overwritten.
  if (leaderboard.length) {
    const capturedAt = new Date();
    await prisma.scoreSnapshot.createMany({
      data: leaderboard.map((r) => ({
        poolId,
        entryId: r.entryId,
        totalPoints: r.total,
        rank: r.rank,
        capturedAt,
      })),
    });
  }

  return leaderboard;
}

export interface LeaderboardRow {
  rank: number;
  entryId: string;
  label: string;
  userId: string | null;
  total: number;
  breakdown: unknown;
  tiebreak: string | null;
}

// Read the cached leaderboard for a pool, ranked by total desc then label.
// (Tiebreak handling is intentionally simple for the MVP — surfaced but not
// auto-applied; the organizer breaks ties using the final-goals tiebreak.)
export async function getLeaderboard(poolId: string): Promise<LeaderboardRow[]> {
  const entries = await prisma.entry.findMany({
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

  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}
