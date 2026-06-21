// Pure ranking for the master leaderboard, split out from leaderboard.ts (which
// touches prisma) so it's unit-testable without a DB.

import { assignRanks } from "@/lib/pool/rank";
import type { LeaderboardRow } from "@/lib/pool/scoring";

const liveTotal = (r: LeaderboardRow) => r.total + (r.projected ?? 0);

// Keep only entered entries from a full-pool live leaderboard, then re-rank from
// 1. liveLeaderboard ranked over the whole pool (incl. private brackets), so the
// surviving rows' ranks have gaps — re-sort by live total (official + any
// projection), break display ties by label, and reassign competition ranks.
export function rankEnteredRows(
  rows: readonly LeaderboardRow[],
  enteredIds: ReadonlySet<string>,
): LeaderboardRow[] {
  const kept = rows.filter((r) => enteredIds.has(r.entryId));
  const sorted = [...kept].sort(
    (a, b) => liveTotal(b) - liveTotal(a) || a.label.localeCompare(b.label),
  );
  return assignRanks(sorted, liveTotal);
}
