// Pure head-to-head diff between two brackets — no DB imports, unit-testable.
// The DB assembly (loading entries, breakdowns, champions) lives in comparison.ts.

import { resolveBracket } from "@/lib/pool/bracket";
import { roundOf, roundLabel } from "@/lib/pool/rounds";
import { TEAMS } from "@/lib/scoring/data";
import type { Picks, Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";

// Every scored knockout match number, in tournament order (bronze 103 excluded).
const SCORED_KNOCKOUTS: number[] = [
  ...Array.from({ length: 16 }, (_, i) => 73 + i), // R32 73–88
  ...Array.from({ length: 8 }, (_, i) => 89 + i), // R16 89–96
  ...Array.from({ length: 4 }, (_, i) => 97 + i), // QF  97–100
  101,
  102, // SF
  104, // Final
];

const name = (code: string | null): string | null => (code ? TEAMS[code] ?? code : null);

// Points a scored knockout match is worth under this config. Mirrors the round
// values in lib/scoring/score.ts — used purely for presenting divergences, never
// to re-score (the scoring engine stays the single source of truth).
function roundPoints(matchNo: number, cfg: ScoringConfig): number {
  switch (roundOf(matchNo)) {
    case "R32":
      return cfg.r32;
    case "R16":
      return cfg.r16;
    case "QF":
      return cfg.qf;
    case "SF":
      return cfg.sf;
    case "FINAL":
      return cfg.final;
    default:
      return 0; // GROUP / BRONZE are not scored knockouts
  }
}

// Teams that have lost a decided knockout match (so are out of the running).
export function eliminatedTeams(results: Results): Set<string> {
  const out = new Set<string>();
  for (const m of Object.values(resolveBracket(results))) {
    if (!m.winner || !m.home || !m.away) continue;
    const loser = m.home === m.winner ? m.away : m.away === m.winner ? m.home : null;
    if (loser) out.add(loser);
  }
  return out;
}

export interface ChampionStatus {
  code: string | null;
  name: string | null;
  alive: boolean;
}

// An entry's champion pick (final, match 104) and whether it's still alive.
export function championStatus(picks: Picks, results: Results): ChampionStatus {
  const code = picks.knockout?.[104] || null;
  if (!code) return { code: null, name: null, alive: false };
  return { code, name: TEAMS[code] ?? code, alive: !eliminatedTeams(results).has(code) };
}

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

// Knockout matches where the two entries picked different winners, latest round
// first (highest match number = deepest stage). Marks who (if anyone) was right.
export function knockoutDivergences(
  a: Picks,
  b: Picks,
  results: Results,
  cfg: ScoringConfig,
): Divergence[] {
  const out: Divergence[] = [];
  for (const mid of SCORED_KNOCKOUTS) {
    const aCode = a.knockout?.[mid] || null;
    const bCode = b.knockout?.[mid] || null;
    if (aCode === bCode) continue; // agreement (incl. both empty) → skip
    if (!aCode && !bCode) continue;
    const winner = results.knockout?.[mid] || null;
    out.push({
      matchNo: mid,
      roundLabel: roundLabel(roundOf(mid)),
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
