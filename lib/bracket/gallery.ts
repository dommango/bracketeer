// A user's whole bracket gallery for a tournament: every bracket they own,
// standalone or pooled, in creation order. Backs the /bracket management page,
// which shows each bracket's placement (a pool, or standalone) and lets the
// owner edit it, enter/leave the Knockout Challenge, or attach it to a pool.

import { prisma } from "@/lib/db";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { knockoutOnlyProgress } from "@/lib/pool/pick-form";
import { knockoutOnlyPicks } from "@/lib/pool/knockout";
import type { PoolFormat } from "@/generated/prisma/enums";

export type BracketPlacement =
  | { kind: "standalone" }
  | { kind: "pool"; poolName: string; joinCode: string };

export interface BracketSummary {
  entryId: string;
  label: string;
  format: PoolFormat;
  locked: boolean;
  enteredChallenge: boolean;
  // Cached official score (0 until results land).
  total: number;
  placement: BracketPlacement;
  // Knockout picks progress (done/total); null for full-bracket entries.
  progress: { done: number; total: number } | null;
}

export async function getUserBrackets(
  userId: string,
  tournamentId: string,
): Promise<BracketSummary[]> {
  const entries = await prisma.entry.findMany({
    where: { userId, tournamentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      format: true,
      locked: true,
      enteredChallenge: true,
      breakdown: { select: { totalPoints: true } },
      pool: { select: { name: true, joinCode: true } },
      picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
    },
  });

  return entries.map((e) => {
    let progress: { done: number; total: number } | null = null;
    if (e.format === "KNOCKOUT" && e.picks.length > 0) {
      const picks = pickRowsToSubmission(e.picks).picks;
      const p = knockoutOnlyProgress(knockoutOnlyPicks(picks));
      progress = { done: p.overall.done, total: p.overall.total };
    }
    return {
      entryId: e.id,
      label: e.label,
      format: e.format,
      locked: e.locked,
      enteredChallenge: e.enteredChallenge,
      total: e.breakdown?.totalPoints ?? 0,
      placement: e.pool
        ? { kind: "pool", poolName: e.pool.name, joinCode: e.pool.joinCode }
        : { kind: "standalone" },
      progress,
    };
  });
}
