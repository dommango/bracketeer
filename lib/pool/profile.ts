// Pure analytics for a single entry's bracket — no DB imports, so it's
// unit-testable without an environment. resolveBracket (lib/pool/bracket) is
// itself pure. These read existing picks/results and *describe* them; they never
// re-score (the engine in lib/scoring stays the source of truth). Point values
// are read from the tournament's ScoringConfig only to project a ceiling.

import { resolveBracket } from "@/lib/pool/bracket";
import { roundPoints } from "@/lib/pool/rounds";
import { TEAMS } from "@/lib/scoring/data";
import type { Picks, Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";

// Scored knockout match numbers (73–104, excluding the unscored bronze M103).
export const SCORED_KNOCKOUTS: number[] = Array.from({ length: 32 }, (_, i) => 73 + i).filter(
  (n) => n !== 103,
);

export interface KnockoutAccuracy {
  decided: number; // knockout matches with a recorded winner
  correct: number; // of those, how many this entry called
  pct: number;
}

// How many decided knockout matches this entry called correctly.
export function knockoutAccuracy(picks: Picks, results: Results): KnockoutAccuracy {
  let decided = 0;
  let correct = 0;
  for (const mid of SCORED_KNOCKOUTS) {
    const actual = results.knockout?.[mid];
    if (!actual) continue;
    decided++;
    if (picks.knockout?.[mid] === actual) correct++;
  }
  return { decided, correct, pct: decided ? Math.round((correct / decided) * 100) : 0 };
}

// Teams that have been knocked out: the loser of any decided knockout match.
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

// The entry's predicted champion (final winner pick) and whether it's still in.
export function championStatus(picks: Picks, results: Results): ChampionStatus {
  const code = picks.knockout?.[104] || null;
  if (!code) return { code: null, name: null, alive: false };
  return { code, name: TEAMS[code] ?? code, alive: !eliminatedTeams(results).has(code) };
}

// Max additional points this entry can still earn, given undecided slots and
// which of its picks are still alive. An upper bound (best case), not a forecast.
export function remainingPotential(picks: Picks, results: Results, cfg: ScoringConfig): number {
  let pts = 0;
  const eliminated = eliminatedTeams(results);

  // Group positions in groups whose standings aren't recorded yet.
  for (const g of Object.keys(picks.groupFirst ?? {})) {
    if (results.groupFirst?.[g]) continue; // group decided → already in current score
    if (picks.groupFirst?.[g]) pts += cfg.groupExact;
  }
  for (const g of Object.keys(picks.groupSecond ?? {})) {
    if (results.groupSecond?.[g]) continue;
    if (picks.groupSecond?.[g]) pts += cfg.groupExact;
  }

  // Third-place advancers, if not yet recorded.
  if (!results.thirdAdvance?.length) {
    pts += Math.min(picks.thirdAdvance?.length ?? 0, 8) * cfg.thirdAdvancer;
  }

  // Undecided knockout matches where the picked team is still alive.
  for (const mid of SCORED_KNOCKOUTS) {
    if (results.knockout?.[mid]) continue; // decided → already counted
    const pick = picks.knockout?.[mid];
    if (pick && !eliminated.has(pick)) pts += roundPoints(mid, cfg);
  }

  // Awards not yet announced.
  for (const k of ["player", "young", "boot", "goal"] as const) {
    if (!results.awards?.[k] && picks.awards?.[k]) pts += cfg.award;
  }

  return pts;
}

export interface BoldestCall {
  matchNo: number;
  code: string;
  name: string;
  pct: number; // share of the pool that made the same (correct) pick
  points: number;
}

// The entry's most contrarian correct knockout call: a match it got right that
// the fewest others in the pool also called. Needs pool-wide pick counts.
export function boldestCall(
  picks: Picks,
  results: Results,
  cfg: ScoringConfig,
  counts: Map<number, Map<string, number>>,
  totals: Map<number, number>,
): BoldestCall | null {
  let best: BoldestCall | null = null;
  for (const mid of SCORED_KNOCKOUTS) {
    const actual = results.knockout?.[mid];
    const pick = picks.knockout?.[mid];
    if (!actual || !pick || pick !== actual) continue;
    const total = totals.get(mid) ?? 0;
    const cnt = counts.get(mid)?.get(pick) ?? 0;
    const pct = total ? Math.round((cnt / total) * 100) : 0;
    const points = roundPoints(mid, cfg);
    if (!best || pct < best.pct || (pct === best.pct && points > best.points)) {
      best = { matchNo: mid, code: pick, name: TEAMS[pick] ?? pick, pct, points };
    }
  }
  return best;
}
