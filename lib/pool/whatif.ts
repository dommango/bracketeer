// Pure "what-if" projection: given the current answer key, recompute every
// entry's standing under a hypothetical winner for one knockout match, and
// report the swing. Reuses the load-bearing scoring engine read-only (scorePicks
// is byte-compatible with the original tool) so projected points always agree
// with real scoring. Safe to run in the browser — no DB, no side effects.

import { scorePicks, DEFAULT_SCORING, type ScoringConfig } from "@/lib/scoring/score";
import type { Picks, Results } from "@/lib/scoring/types";

export interface WhatIfEntry {
  entryId: string;
  label: string;
  picks: Picks;
}

export interface ProjectedRow {
  entryId: string;
  label: string;
  baseTotal: number;
  total: number; // projected total under the hypothetical
  delta: number; // total − baseTotal
  baseRank: number;
  rank: number; // projected rank
  rankDelta: number; // baseRank − rank (positive = climbed)
}

// Rank by points desc, then label asc (matches getLeaderboard's ordering), so
// projected ranks line up with how the real leaderboard would render.
function rankBy<T extends { entryId: string; label: string }>(
  rows: T[],
  pointsOf: (r: T) => number,
): Map<string, number> {
  // Standard competition ranking ("1224"): tied points share a place, matching
  // getLeaderboard. Rank = entries strictly ahead + 1; label only orders display.
  const ranks = new Map<string, number>();
  for (const r of rows) {
    const ahead = rows.filter((o) => pointsOf(o) > pointsOf(r)).length;
    ranks.set(r.entryId, ahead + 1);
  }
  return ranks;
}

export interface WhatIfOverride {
  matchNo: number;
  winnerCode: string;
}

// Project standings if `override.winnerCode` wins `override.matchNo`. Rows are
// returned in projected-rank order.
export function projectStandings(
  entries: WhatIfEntry[],
  baseResults: Results,
  override: WhatIfOverride,
  cfg: ScoringConfig = DEFAULT_SCORING,
): ProjectedRow[] {
  const projResults: Results = {
    ...baseResults,
    knockout: { ...baseResults.knockout, [override.matchNo]: override.winnerCode },
  };

  const scored = entries.map((e) => ({
    entryId: e.entryId,
    label: e.label,
    baseTotal: scorePicks(e.picks, baseResults, cfg).total,
    total: scorePicks(e.picks, projResults, cfg).total,
  }));

  const baseRanks = rankBy(scored, (r) => r.baseTotal);
  const projRanks = rankBy(scored, (r) => r.total);

  const rows: ProjectedRow[] = scored.map((r) => {
    const baseRank = baseRanks.get(r.entryId)!;
    const rank = projRanks.get(r.entryId)!;
    return {
      entryId: r.entryId,
      label: r.label,
      baseTotal: r.baseTotal,
      total: r.total,
      delta: r.total - r.baseTotal,
      baseRank,
      rank,
      rankDelta: baseRank - rank,
    };
  });

  return rows.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
}
