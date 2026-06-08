// Pure validation for group standings before they are written to the answer key.
// A contradictory answer key (the same team placed twice) would silently corrupt
// scoring for everyone, so the result service rejects it. Kept DB-free so it can
// be unit-tested in isolation.

import type { Results } from "@/lib/scoring/types";

type Standings = Pick<Results, "groupFirst" | "groupSecond" | "thirdAdvance">;

// Returns a human-readable reason if the standings are self-contradictory, else
// null. A team may appear at most once across all group winners, runners-up, and
// third-place advancers (each team is in one group with one fate).
export function findStandingsConflict(s: Standings): string | null {
  const groupFirst = s.groupFirst ?? {};
  const groupSecond = s.groupSecond ?? {};
  const thirds = s.thirdAdvance ?? [];

  for (const g of Object.keys(groupFirst)) {
    if (groupFirst[g] && groupSecond[g] && groupFirst[g] === groupSecond[g]) {
      return `${groupFirst[g]} cannot be both 1st and 2nd in group ${g}`;
    }
  }

  const placed = new Map<string, string>();
  const claim = (code: string, where: string): string | null => {
    if (!code) return null;
    const prior = placed.get(code);
    if (prior) return `${code} is placed in both ${prior} and ${where}`;
    placed.set(code, where);
    return null;
  };

  for (const g of Object.keys(groupFirst)) {
    const conflict = claim(groupFirst[g], `1st of group ${g}`);
    if (conflict) return conflict;
  }
  for (const g of Object.keys(groupSecond)) {
    const conflict = claim(groupSecond[g], `2nd of group ${g}`);
    if (conflict) return conflict;
  }
  for (const code of thirds) {
    const conflict = claim(code, "third-place advancers");
    if (conflict) return conflict;
  }

  return null;
}
