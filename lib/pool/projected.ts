// Projected live points: what each entry would gain if every live knockout
// match ended at its current score. Display-only — never written to
// ScoreBreakdown and never part of the official answer key. Group-stage live
// matches are excluded because group points come from admin-entered standings,
// not per-match winners.

import {
  roundPointsFor,
  stagePoints,
  winnersByStage,
  KNOCKOUT_BUCKET,
  DEFAULT_SCORING,
  type KnockoutStage,
  type ScoringConfig,
} from "@/lib/scoring/score";

export interface LiveResultRow {
  matchNo: number;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

export interface LiveLeader {
  matchNo: number;
  leadingCode: string;
}

const isKnockout = (n: number) => n >= 73 && n <= 104;

// The currently-leading side of each live knockout match. Ties and unknown
// teams project nothing — a draw resolves on penalties, which we can't guess.
// `decided` is the set of match numbers already recorded in the answer key: a
// decided match is in every entry's OFFICIAL total, so projecting it again from
// a Result row the feed hasn't flipped to FINAL yet would pay the same match
// twice on the live board during the whistle→feed-reconcile window.
export function liveLeaders(
  rows: LiveResultRow[],
  decided: ReadonlySet<number> = new Set(),
): LiveLeader[] {
  const out: LiveLeader[] = [];
  for (const r of rows) {
    if (r.status !== "LIVE" || !isKnockout(r.matchNo) || decided.has(r.matchNo)) continue;
    if (r.homeScore == null || r.awayScore == null || r.homeScore === r.awayScore) continue;
    const leadingCode = r.homeScore > r.awayScore ? r.homeTeamCode : r.awayTeamCode;
    if (!leadingCode) continue;
    out.push({ matchNo: r.matchNo, leadingCode });
  }
  return out;
}

// Sum the round points of every live match whose leader matches the entry's
// pick. Bronze (103) yields 0 via roundPointsFor, mirroring official scoring.
//
// Placement-agnostic (cfg.knockoutPlacementAgnostic): the projection must match
// how the match will actually score, so a round's points go to every DISTINCT
// team the entry picked to win any match in that round that is currently leading
// a live match in that round — minus teams already credited for that round via a
// decided (official) result, so a round the entry already banked is never paid
// twice. `officialKnockout` supplies those decided winners.
export function projectedLivePoints(
  leaders: LiveLeader[],
  knockoutPicksByEntry: Map<string, Record<number, string>>,
  cfgOverride: Record<string, number> = {},
  officialKnockout: Record<number, string> = {},
): Map<string, number> {
  const cfg: ScoringConfig = { ...DEFAULT_SCORING, ...cfgOverride };
  const out = new Map<string, number>();

  if (!cfg.knockoutPlacementAgnostic) {
    for (const [entryId, picks] of knockoutPicksByEntry) {
      let pts = 0;
      for (const { matchNo, leadingCode } of leaders) {
        if (picks[matchNo] === leadingCode) pts += roundPointsFor(matchNo, cfg);
      }
      out.set(entryId, pts);
    }
    return out;
  }

  // Teams currently leading a live match, by round — excluding any already
  // credited for that round by a decided result (else the entry double-banks it).
  const leadingByStage = winnersByStage(
    Object.fromEntries(leaders.map((l) => [l.matchNo, l.leadingCode])),
  );
  const decidedByStage = winnersByStage(officialKnockout);
  const stages = Object.keys(KNOCKOUT_BUCKET) as KnockoutStage[];
  for (const stage of stages) {
    for (const team of decidedByStage[stage]) leadingByStage[stage].delete(team);
  }

  for (const [entryId, picks] of knockoutPicksByEntry) {
    const pickedByStage = winnersByStage(picks);
    let pts = 0;
    for (const stage of stages) {
      const p = stagePoints(stage, cfg);
      if (!p) continue;
      for (const team of pickedByStage[stage]) {
        if (leadingByStage[stage].has(team)) pts += p;
      }
    }
    out.set(entryId, pts);
  }
  return out;
}
