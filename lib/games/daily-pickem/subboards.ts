// Per-stage sub-boards for the daily pick'em, derived with NO schema change from
// the per-pick scoring already cached on ScoreBreakdown.perPick ({ "M9": 3, ... }).
// Each pick's points land in the bucket for stageOf(matchNo), so the six sub-boards
// (GROUP / R32 / R16 / QF / SF / FINAL) sum to the overall daily total. The GROUP
// sub-board equals the legacy Match Day Pickem total by construction.

import { stageOf, STAGE_ORDER, type Stage } from "@/lib/games/stage";

export type SubBoardTotals = Record<Stage, number>;

function emptyTotals(): SubBoardTotals {
  return { GROUP: 0, R32: 0, R16: 0, QF: 0, SF: 0, FINAL: 0 };
}

// Sum a cached perPick map into per-stage totals + the overall total. Keys whose
// match number is unscored / out of range (e.g. bronze M103) are ignored.
export function subBoardsFromPerPick(
  perPick: Record<string, number> | null | undefined,
): { byStage: SubBoardTotals; overall: number } {
  const byStage = emptyTotals();
  let overall = 0;
  for (const [key, value] of Object.entries(perPick ?? {})) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const matchNo = Number(key.replace(/^M/, ""));
    const stage = stageOf(matchNo);
    if (!stage) continue;
    byStage[stage] += value;
    overall += value;
  }
  return { byStage, overall };
}

// The GROUP sub-board total — the legacy Match Day Pickem score, recovered from the
// same perPick. Proves "MD3 group standings stay intact" for the regression smoke.
export function groupSubBoard(perPick: Record<string, number> | null | undefined): number {
  return subBoardsFromPerPick(perPick).byStage.GROUP;
}

export { STAGE_ORDER };
