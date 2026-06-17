// Pure backing logic for the team drill-down: who in the pool staked a team and
// how deeply. Env-free (no prisma) so it can be unit-tested directly; the impure
// getTeamDetail in team-detail.ts composes it. Does NOT touch lib/scoring.

import type { EntryPicks } from "@/lib/pool/entry-picks";
import type { Picks } from "@/lib/scoring/types";

export interface TeamBacker {
  entryId: string;
  label: string;
  // Human label of the deepest round/finish this entry backed the team to reach.
  as: string;
  // Sort weight (higher = deeper); champion 7 … third-place 1.
  depth: number;
}

// The round a knockout *winner* pick implies the team reached (winning match N
// advances it to the next round). Bronze (103) is unscored, so it never counts.
function koStake(maxWon: number): { as: string; depth: number } | null {
  if (maxWon === 104) return { as: "Champion", depth: 7 };
  if (maxWon === 101 || maxWon === 102) return { as: "Finalist", depth: 6 };
  if (maxWon >= 97 && maxWon <= 100) return { as: "Semifinalist", depth: 5 };
  if (maxWon >= 89 && maxWon <= 96) return { as: "Quarterfinalist", depth: 4 };
  if (maxWon >= 73 && maxWon <= 88) return { as: "Round of 16", depth: 3 };
  return null;
}

// One entry's deepest backing of a team: its furthest knockout winner pick, else
// the team's predicted group finish. Null when the entry never staked the team.
function deepestStake(picks: Picks, code: string): { as: string; depth: number } | null {
  let maxWon = 0;
  for (const [no, c] of Object.entries(picks.knockout)) {
    const n = Number(no);
    if (c === code && n !== 103 && n > maxWon) maxWon = n;
  }
  const ko = koStake(maxWon);
  if (ko) return ko;

  for (const [g, c] of Object.entries(picks.groupFirst)) {
    if (c === code) return { as: `Group ${g} winner`, depth: 2 };
  }
  for (const [g, c] of Object.entries(picks.groupSecond)) {
    if (c === code) return { as: `Group ${g} runner-up`, depth: 1 };
  }
  if (picks.thirdAdvance.includes(code as never)) return { as: "3rd → advances", depth: 1 };
  return null;
}

// Everyone in the pool who backed the team, deepest stake first (ties alphabetical).
export function teamBackers(entries: EntryPicks[], code: string): TeamBacker[] {
  const out: TeamBacker[] = [];
  for (const e of entries) {
    const stake = deepestStake(e.picks, code);
    if (stake) out.push({ entryId: e.entryId, label: e.label, as: stake.as, depth: stake.depth });
  }
  return out.sort((a, b) => b.depth - a.depth || a.label.localeCompare(b.label));
}
