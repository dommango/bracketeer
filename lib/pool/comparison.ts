// DB assembly for the head-to-head compare page: load two entries, their cached
// breakdowns + champions, and the pure knockout divergence list.

import { prisma } from "@/lib/db";
import { getPoolAnswerKey } from "@/lib/pool/queries";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { championStatus, type ChampionStatus } from "@/lib/pool/profile";
import { knockoutDivergences, type Divergence } from "@/lib/pool/compare";

export interface CompareSide {
  entryId: string;
  label: string;
  total: number;
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

  const [entries, ctx] = await Promise.all([
    prisma.entry.findMany({
      where: { id: { in: [aId, bId] }, poolId },
      include: { picks: true, breakdown: true },
    }),
    getPoolAnswerKey(poolId),
  ]);
  if (!ctx) return null;

  const byId = new Map(entries.map((e) => [e.id, e]));
  const ea = byId.get(aId);
  const eb = byId.get(bId);
  if (!ea || !eb) return null;

  const { results, cfg } = ctx;
  const aPicks = pickRowsToSubmission(ea.picks).picks;
  const bPicks = pickRowsToSubmission(eb.picks).picks;

  const side = (e: typeof ea, picks: typeof aPicks): CompareSide => ({
    entryId: e.id,
    label: e.label,
    total: e.breakdown?.totalPoints ?? 0,
    byCategory: (e.breakdown?.byCategory ?? {}) as Record<string, number>,
    champion: championStatus(picks, results),
  });

  return {
    a: side(ea, aPicks),
    b: side(eb, bPicks),
    divergences: knockoutDivergences(aPicks, bPicks, results, cfg),
  };
}
