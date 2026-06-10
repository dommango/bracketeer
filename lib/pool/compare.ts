// Pure head-to-head diff between two brackets — no DB imports, unit-testable.
// The DB assembly (loading entries, breakdowns, champions) lives in comparison.ts.

import { SCORED_KNOCKOUTS } from "@/lib/pool/profile";
import { roundLabel, roundPoints } from "@/lib/pool/rounds";
import { TEAMS } from "@/lib/scoring/data";
import type { Picks, Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";

export interface Divergence {
  matchNo: number;
  roundLabel: string;
  points: number;
  aCode: string | null;
  aName: string | null;
  bCode: string | null;
  bName: string | null;
  winnerCode: string | null;
  decided: boolean;
  aCorrect: boolean;
  bCorrect: boolean;
}

const name = (code: string | null): string | null => (code ? TEAMS[code] ?? code : null);

// Knockout matches where the two entries picked different winners, latest round
// first (highest match number = deepest stage). Marks who (if anyone) was right.
export function knockoutDivergences(a: Picks, b: Picks, results: Results, cfg: ScoringConfig): Divergence[] {
  const out: Divergence[] = [];
  for (const mid of SCORED_KNOCKOUTS) {
    const aCode = a.knockout?.[mid] || null;
    const bCode = b.knockout?.[mid] || null;
    if (aCode === bCode) continue; // agreement (incl. both empty) → skip
    if (!aCode && !bCode) continue;
    const winner = results.knockout?.[mid] || null;
    out.push({
      matchNo: mid,
      roundLabel: roundLabel(mid),
      points: roundPoints(mid, cfg),
      aCode,
      aName: name(aCode),
      bCode,
      bName: name(bCode),
      winnerCode: winner,
      decided: Boolean(winner),
      aCorrect: Boolean(winner) && aCode === winner,
      bCorrect: Boolean(winner) && bCode === winner,
    });
  }
  return out.sort((x, y) => y.matchNo - x.matchNo);
}
