// Bracket slot resolution — ported verbatim from WorldCup2026Bracket.html.
//
// IMPORTANT: the third-place assignment is a GREEDY first-eligible match in
// match-id order. This differs from FIFA's deterministic placement table, but
// it is exactly how the original tool resolved brackets, so picks scored here
// match what contestants saw. Do NOT replace this with the FIFA table without
// re-validating every imported bracket.

import { GROUPS, R32 } from "./data";
import type { GroupLetter, Picks, TeamCode } from "./types";

export type ResolvedR32 = Record<number, { a: TeamCode | null; b: TeamCode | null }>;

// Resolve every R32 slot to a concrete team code (or null) from a set of picks.
export function resolveR32Slots(picks: Picks): ResolvedR32 {
  const thirds = (picks.thirdAdvance || []).slice();

  const teamGroup: Record<TeamCode, GroupLetter> = {};
  for (const [g, teams] of Object.entries(GROUPS))
    for (const t of teams) teamGroup[t] = g;

  // Collect third-slots in match-id order and assign greedily.
  const thirdAssign: Record<string, TeamCode> = {};
  for (const m of R32) {
    for (const side of ["a", "b"] as const) {
      const slot = m[side];
      if ("third" in slot) {
        const eligible = thirds.filter((t) => slot.third.includes(teamGroup[t]));
        if (eligible.length > 0) {
          const chosen = eligible[0];
          thirdAssign[`${m.id}${side}`] = chosen;
          thirds.splice(thirds.indexOf(chosen), 1);
        }
      }
    }
  }

  const resolved: ResolvedR32 = {};
  for (const m of R32) {
    const resolveSlot = (
      slot: (typeof m)["a"],
      side: "a" | "b",
    ): TeamCode | null => {
      if ("third" in slot) return thirdAssign[`${m.id}${side}`] || null;
      const g = slot.group;
      return slot.pos === 1
        ? picks.groupFirst[g] || null
        : picks.groupSecond[g] || null;
    };
    resolved[m.id] = {
      a: resolveSlot(m.a, "a"),
      b: resolveSlot(m.b, "b"),
    };
  }
  return resolved;
}

// Winner of any match, per a set of picks (knockout map holds the picked code).
export function winnerOf(picks: Picks, matchId: number): TeamCode | null {
  return picks.knockout[matchId] || null;
}

// Loser of a match given resolved R32 teams (used for bronze-final feeders).
export function loserOf(
  picks: Picks,
  matchId: number,
  resolvedTeams: ResolvedR32,
): TeamCode | null {
  const w = winnerOf(picks, matchId);
  if (!w) return null;
  const ab = resolvedTeams[matchId];
  if (!ab) return null;
  if (ab.a === w) return ab.b;
  if (ab.b === w) return ab.a;
  return null;
}
