// One entry's decoded picks. Lives in its own env-free module (no prisma) so the
// pure aggregation helpers — e.g. team-backers — can share the type without
// dragging in the DB layer. queries.ts re-exports it for existing call sites.

import type { Picks } from "@/lib/scoring/types";

export interface EntryPicks {
  entryId: string;
  label: string;
  picks: Picks;
}
