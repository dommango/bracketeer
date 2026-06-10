// Assemble an entry's profile view: cached score breakdown + read-only analytics
// (knockout accuracy, champion aliveness, point ceiling, boldest call). All math
// lives in the pure helpers in profile.ts; this layer is the DB glue.

import { prisma } from "@/lib/db";
import { getPoolAnswerKey } from "@/lib/pool/queries";
import { getPoolKnockoutShares } from "@/lib/pool/pickSplit";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import {
  knockoutAccuracy,
  championStatus,
  remainingPotential,
  boldestCall,
  type KnockoutAccuracy,
  type ChampionStatus,
  type BoldestCall,
} from "@/lib/pool/profile";

export interface EntryProfile {
  entryId: string;
  label: string;
  tiebreak: string | null;
  total: number;
  byCategory: Record<string, number>;
  accuracy: KnockoutAccuracy;
  champion: ChampionStatus;
  ceiling: number; // current total + max still-earnable points
  potential: number; // max still-earnable points
  boldest: BoldestCall | null;
}

export async function getEntryProfile(
  poolId: string,
  entryId: string,
): Promise<EntryProfile | null> {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, poolId },
    include: { picks: true, breakdown: true },
  });
  if (!entry) return null;

  const ctx = await getPoolAnswerKey(poolId);
  if (!ctx) return null;
  const { results, cfg } = ctx;

  const { picks } = pickRowsToSubmission(entry.picks);
  const { counts, totals } = await getPoolKnockoutShares(poolId);

  const total = entry.breakdown?.totalPoints ?? 0;
  const potential = remainingPotential(picks, results, cfg);

  return {
    entryId: entry.id,
    label: entry.label,
    tiebreak: entry.tiebreak,
    total,
    byCategory: (entry.breakdown?.byCategory ?? {}) as Record<string, number>,
    accuracy: knockoutAccuracy(picks, results),
    champion: championStatus(picks, results),
    ceiling: total + potential,
    potential,
    boldest: boldestCall(picks, results, cfg, counts, totals),
  };
}
