// Winner resolution for a finished knockout fixture. Pure (no env/DB), so the
// poller and its tests can share one source of truth. Regulation/ET goals
// decide; when those are level we fall back to the penalty shootout, which
// API-Football reports in score.penalty while leaving goals tied for a
// PEN-decided knockout.

import type { FinishedFixture } from "./client";

export function resolveWinnerExternalId(f: FinishedFixture): string | null {
  if (f.homeGoals != null && f.awayGoals != null && f.homeGoals !== f.awayGoals) {
    return f.homeGoals > f.awayGoals ? f.homeExternalId : f.awayExternalId;
  }
  if (f.homePens != null && f.awayPens != null && f.homePens !== f.awayPens) {
    return f.homePens > f.awayPens ? f.homeExternalId : f.awayExternalId;
  }
  return null;
}
