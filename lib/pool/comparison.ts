// DB assembly for the head-to-head compare page: load two entries, their cached
// breakdowns + champions, and the pure knockout divergence list.

import { prisma } from "@/lib/db";
import { asResults, asScoringConfig } from "@/lib/pool/scoring";
import { liveLeaderboard } from "@/lib/pool/queries";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { championStatus, knockoutDivergences, type ChampionStatus, type Divergence } from "@/lib/pool/compare";

export interface CompareSide {
  entryId: string;
  label: string;
  total: number; // live total (official + provisional), matching the leaderboard
  projected?: number; // provisional portion of `total`
  byCategory: Record<string, number>;
  champion: ChampionStatus;
}

export interface Comparison {
  a: CompareSide;
  b: CompareSide;
  divergences: Divergence[];
}

export async function getComparison(
  poolId: string,
  aId: string,
  bId: string,
): Promise<Comparison | null> {
  if (aId === bId) return null;

  const [pool, entries, live] = await Promise.all([
    prisma.pool.findUnique({
      where: { id: poolId },
      include: { tournament: true },
    }),
    prisma.entry.findMany({
      where: { id: { in: [aId, bId] }, poolId },
      include: { picks: true, breakdown: true },
    }),
    liveLeaderboard(poolId),
  ]);
  if (!pool) return null;

  const liveById = new Map(live.map((r) => [r.entryId, r]));

  const byId = new Map(entries.map((e) => [e.id, e]));
  const ea = byId.get(aId);
  const eb = byId.get(bId);
  if (!ea || !eb) return null;

  const results = asResults(pool.tournament.officialResults);
  const cfg = asScoringConfig(pool.tournament.scoringConfig);
  const aPicks = pickRowsToSubmission(ea.picks).picks;
  const bPicks = pickRowsToSubmission(eb.picks).picks;

  const side = (e: typeof ea, picks: typeof aPicks): CompareSide => {
    const lr = liveById.get(e.id);
    const projected = lr?.projected ?? 0;
    return {
      entryId: e.id,
      label: e.label,
      // Live total (official + provisional), to match the leaderboard.
      total: (lr?.total ?? e.breakdown?.totalPoints ?? 0) + projected,
      projected: projected > 0 ? projected : undefined,
      byCategory: (e.breakdown?.byCategory ?? {}) as Record<string, number>,
      champion: championStatus(picks, results),
    };
  };

  return {
    a: side(ea, aPicks),
    b: side(eb, bPicks),
    divergences: knockoutDivergences(aPicks, bPicks, results, cfg),
  };
}
