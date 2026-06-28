// Resolve the *actual* knockout bracket from a tournament's answer key.
//
// The scoring engine only needs results.knockout[matchNo] = winningTeamCode, but
// to display the bracket and to validate manual result entry we must know which
// two teams actually contest each match. That resolution reuses resolve.ts's
// greedy third-place logic so the answer key's bracket is built exactly the way
// the original tool builds a contestant's bracket — no second source of truth.

import { resolveR32Slots } from "@/lib/scoring/resolve";
import { TEAMS, R32, R16, QF, SF, BRONZE, FINAL } from "@/lib/scoring/data";
import type { Results, TeamCode } from "@/lib/scoring/types";

export interface ResolvedMatch {
  home: TeamCode | null;
  away: TeamCode | null;
  winner: TeamCode | null;
}

export type ResolvedBracket = Record<number, ResolvedMatch>;

// Concrete teams for every knockout match (73–104) given the answer key so far.
// Earlier rounds resolve from group standings + thirds; later rounds resolve from
// the winners recorded for their feeder matches. Unknown slots stay null.
export function resolveBracket(results: Results): ResolvedBracket {
  const knockout = results.knockout || {};
  const winnerAt = (id: number): TeamCode | null => knockout[id] || null;

  const out: ResolvedBracket = {};

  // R32 (73–88): both teams come from group standings via the greedy resolver.
  const r32 = resolveR32Slots(results);
  for (const m of R32) {
    out[m.id] = { home: r32[m.id].a, away: r32[m.id].b, winner: winnerAt(m.id) };
  }

  // R16 / QF / SF (89–102): each side is the recorded winner of a feeder match.
  const feed = (id: number): TeamCode | null => out[id]?.winner ?? null;
  for (const m of [...R16, ...QF, ...SF]) {
    out[m.id] = { home: feed(m.a), away: feed(m.b), winner: winnerAt(m.id) };
  }

  // Bronze (103): the two semifinal losers (the side that isn't the winner).
  const loserAt = (id: number): TeamCode | null => {
    const rm = out[id];
    if (!rm || !rm.winner) return null;
    if (rm.home === rm.winner) return rm.away;
    if (rm.away === rm.winner) return rm.home;
    return null;
  };
  out[BRONZE.id] = {
    home: loserAt(BRONZE.aLoser),
    away: loserAt(BRONZE.bLoser),
    winner: winnerAt(BRONZE.id),
  };

  // Final (104): the two semifinal winners.
  out[FINAL.id] = { home: feed(FINAL.a), away: feed(FINAL.b), winner: winnerAt(FINAL.id) };

  return out;
}

// Unordered-team-pair → knockout match number, for every knockout match (73–104)
// whose two teams are already resolved. Mirrors buildGroupPairMatchNos() for the
// group stage: it lets the score poller map an API fixture to our match by the two
// teams playing, with NO dependency on a pre-generated fixture-id map. Each knockout
// matchup is a unique unordered pair (a team can't be in two live ties at once), so
// the key never collides. Unresolved slots (feeders unscored) are skipped.
export function buildKnockoutPairMatchNos(results: Results): Map<string, number> {
  const pairs = new Map<string, number>();
  const bracket = resolveBracket(results);
  for (const [matchNo, m] of Object.entries(bracket)) {
    if (!m.home || !m.away) continue;
    pairs.set([m.home, m.away].sort().join("_"), Number(matchNo));
  }
  return pairs;
}

const KNOCKOUT_RANGE = (n: number) => n >= 73 && n <= 104;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

// Validate a proposed knockout winner before it is written to the answer key.
// Rejects unknown teams, non-knockout match numbers, and a winner that is not
// one of the two teams the bracket says contest that match. When the match's
// teams are not yet resolvable (its feeders are unscored), we cannot disprove
// the entry, so we allow it rather than block the admin.
export function validateKnockoutWinner(
  results: Results,
  matchNo: number,
  code: TeamCode,
): ValidationResult {
  if (!KNOCKOUT_RANGE(matchNo)) {
    return { ok: false, reason: `Match ${matchNo} is not a knockout match (73–104).` };
  }
  if (!code || !TEAMS[code]) {
    return { ok: false, reason: `Unknown team code "${code}".` };
  }
  const match = resolveBracket(results)[matchNo];
  if (!match) {
    return { ok: false, reason: `Match ${matchNo} has no bracket slot.` };
  }
  // Only enforce membership once both teams are known.
  if (match.home && match.away && code !== match.home && code !== match.away) {
    return {
      ok: false,
      reason: `${code} is not in match ${matchNo} (${match.home} vs ${match.away}).`,
    };
  }
  return { ok: true };
}
