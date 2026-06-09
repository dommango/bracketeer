// Pure pick-split: how a pool's entries split their winner pick across the two
// teams in a knockout match. "Other" captures entries whose bracket sent a
// different team here (the greedy third-place resolver means brackets diverge).

import { TEAMS } from "@/lib/scoring/data";

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "TBD";

export interface PickSplitSlice {
  code: string | null;
  name: string;
  count: number;
  pct: number; // share of `total`, rounded to whole percent (0 when no picks)
}

export interface PickSplit {
  total: number; // entries who made a winner pick for this match
  home: PickSplitSlice;
  away: PickSplitSlice;
  other: PickSplitSlice;
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

// `picks` is each entry's winner-pick code for this match (skip absent picks).
export function buildPickSplit(
  homeCode: string | null,
  awayCode: string | null,
  picks: Array<string | null | undefined>,
): PickSplit {
  const made = picks.filter((p): p is string => Boolean(p));
  const total = made.length;

  let home = 0;
  let away = 0;
  let other = 0;
  for (const p of made) {
    if (homeCode && p === homeCode) home += 1;
    else if (awayCode && p === awayCode) away += 1;
    else other += 1;
  }

  return {
    total,
    home: { code: homeCode, name: teamName(homeCode), count: home, pct: pct(home, total) },
    away: { code: awayCode, name: teamName(awayCode), count: away, pct: pct(away, total) },
    other: { code: null, name: "Other", count: other, pct: pct(other, total) },
  };
}
