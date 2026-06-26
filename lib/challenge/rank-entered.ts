// Pure ranking for the Challenge leaderboard, split out from leaderboard.ts
// (which touches prisma) so it's unit-testable without a DB.

import { assignRanksByCompare } from "@/lib/pool/rank";
import { compareMd3Tiebreak } from "@/lib/challenge/md3-tiebreak";
import type { LeaderboardRow } from "@/lib/pool/scoring";

const liveTotal = (r: LeaderboardRow) => r.total + (r.projected ?? 0);

// The ranking order, EXCLUDING label: live total first, then — for MD3 rows that
// carry it — the quality tiebreak (most exact scores, etc.). compareMd3Tiebreak
// returns 0 when either side lacks the vector, so knockout/full rows fall back to
// total-only ranking exactly as before. Two entries share a rank only on a true
// dead heat across both criteria.
const rankCompare = (a: LeaderboardRow, b: LeaderboardRow) =>
  liveTotal(b) - liveTotal(a) || compareMd3Tiebreak(a.md3Tiebreak, b.md3Tiebreak);

// Keep only entered entries from a full-pool live leaderboard, then re-rank from
// 1. liveLeaderboard ranked over the whole pool (incl. private brackets), so the
// surviving rows' ranks have gaps — re-sort by the ranking order, break any
// remaining display tie by label, and reassign competition ranks decisively.
export function rankEnteredRows(
  rows: readonly LeaderboardRow[],
  enteredIds: ReadonlySet<string>,
): LeaderboardRow[] {
  const kept = rows.filter((r) => enteredIds.has(r.entryId));
  const sorted = [...kept].sort(
    (a, b) => rankCompare(a, b) || a.label.localeCompare(b.label),
  );
  return assignRanksByCompare(sorted, rankCompare);
}
