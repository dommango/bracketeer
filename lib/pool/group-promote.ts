// Auto-promotion of completed groups to the official answer key.
//
// While a group is in progress its standings are provisional (display + live
// leaderboard delta). Once all six of a group's matches are FINAL the table can
// no longer change, so its determinate 1st/2nd become official — written into
// Tournament.officialResults by the DB wrapper in lib/pool/results.ts, which then
// feeds the knockout bracket (resolved from official results only). Third-place
// advancers depend on the best-8-of-12 cut across every group, so they only
// finalize once the whole group stage is complete.
//
// Pure and DB-free: it decides WHAT to promote; the caller decides admin-vs-auto
// precedence (admin entries are never overwritten) and persistence.

import { computeGroupTables, provisionalStandings, type GroupResultRow } from "./group-table";
import { GROUPS } from "@/lib/scoring/data";
import type { TeamCode } from "@/lib/scoring/types";

export interface PromotedStandings {
  groupFirst: Record<string, TeamCode>;
  groupSecond: Record<string, TeamCode>;
  thirdAdvance: TeamCode[]; // populated only when ALL groups are complete
}

const GROUP_COUNT = Object.keys(GROUPS).length;

// A group is complete when every one of its four teams has played all three
// matches (i.e. all six group games are FINAL). `finalRows` must contain ONLY
// FINAL group results — a LIVE match means the group is still in progress.
export function promoteCompletedGroups(finalRows: GroupResultRow[]): PromotedStandings {
  const tables = computeGroupTables(finalRows);
  const prov = provisionalStandings(tables);

  const groupFirst: Record<string, TeamCode> = {};
  const groupSecond: Record<string, TeamCode> = {};
  let completeGroups = 0;

  for (const [g, table] of Object.entries(tables)) {
    const complete = table.length === 4 && table.every((r) => r.played === 3);
    if (!complete) continue;
    completeGroups += 1;
    // Only determinate (untied) positions promote; a genuine tie is left for an
    // admin to resolve (we never guess fair-play / drawing-of-lots outcomes).
    if (prov.groupFirst[g]) groupFirst[g] = prov.groupFirst[g];
    if (prov.groupSecond[g]) groupSecond[g] = prov.groupSecond[g];
  }

  const allComplete = completeGroups === GROUP_COUNT;
  return { groupFirst, groupSecond, thirdAdvance: allComplete ? prov.thirdAdvance : [] };
}
