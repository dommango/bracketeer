// Overlays live provisional group standings onto the official answer key for
// display-only scoring. The official key is authoritative: any group an admin
// has already finalized (has an official 1st place) is left untouched, and
// official third-place advancers win once set. Nothing here is ever persisted —
// it feeds the additive "live" leaderboard delta, mirroring lib/pool/projected.ts.

import { scorePicks, type ScoringConfig } from "@/lib/scoring/score";
import type { Picks, Results } from "@/lib/scoring/types";
import type { ProvisionalStandings } from "@/lib/pool/group-table";

export function overlayProvisional(
  official: Results,
  provisional: ProvisionalStandings,
): Results {
  const groupFirst = { ...official.groupFirst };
  const groupSecond = { ...official.groupSecond };

  for (const g of Object.keys(provisional.groupFirst)) {
    if (official.groupFirst?.[g]) continue; // admin-finalized group → keep official
    groupFirst[g] = provisional.groupFirst[g];
    if (provisional.groupSecond[g]) groupSecond[g] = provisional.groupSecond[g];
  }

  const thirdAdvance =
    official.thirdAdvance && official.thirdAdvance.length > 0
      ? official.thirdAdvance
      : provisional.thirdAdvance;

  return { ...official, groupFirst, groupSecond, thirdAdvance };
}

// Additive group+thirds points the overlay awards an entry beyond the official
// key. Non-negative: the overlay only adds positions, never removes them.
export function provisionalGroupDelta(
  picks: Picks,
  official: Results,
  overlay: Results,
  cfg: ScoringConfig,
): number {
  const off = scorePicks(picks, official, cfg).breakdown;
  const ov = scorePicks(picks, overlay, cfg).breakdown;
  return ov.group + ov.thirds - (off.group + off.thirds);
}
