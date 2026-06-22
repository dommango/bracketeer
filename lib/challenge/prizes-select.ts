// Pure prize-winner selection, split out from prizes.ts (which touches prisma)
// so the rule is unit-testable without a DB. A clean rank-1 winner, a rank-1 tie
// (an admin must resolve — we never auto-pick between equal leaders, matching the
// "organizer breaks ties" stance), or nobody.

import type { LeaderboardRow } from "@/lib/pool/scoring";

export type PrizeOutcome =
  | { kind: "winner"; row: LeaderboardRow }
  | { kind: "tie" }
  | { kind: "none" };

export function selectPrizeWinner(rows: readonly LeaderboardRow[]): PrizeOutcome {
  const leaders = rows.filter((r) => r.rank === 1);
  if (leaders.length === 0) return { kind: "none" };
  if (leaders.length > 1) return { kind: "tie" };
  return { kind: "winner", row: leaders[0] };
}
