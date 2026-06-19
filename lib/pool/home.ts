// Pure Home-dashboard logic + the HomeView contract. The standing-gap math and
// next-match selection are DB-free so they're unit-testable; the prisma
// aggregator (getHomeView) lives in queries.ts and fills these shapes.

import type { Mover } from "@/lib/pool/movers";
import type { Accuracy, BoldestCall } from "@/lib/pool/profile";
import type { MatchCenterRow } from "@/lib/pool/match-center";
import type { PickAnalytics } from "@/lib/pool/pick-analytics";
import type { UpsetRow } from "@/lib/odds/upset";
import type { ImpliedProbs } from "@/lib/odds/map";

// A leaderboard row reduced to what the standing card needs. `projected` is the
// live (provisional group + knockout) delta; gaps and the displayed total use the
// live total so the card matches the re-ranked leaderboard.
export interface LeaderboardLike {
  rank: number;
  entryId: string;
  label: string;
  userId: string | null;
  total: number;
  projected?: number;
}

export interface Standing {
  rank: number;
  entryId: string;
  label: string;
  total: number;
  entryCount: number;
  gapToLeader: number; // leader total − your total (0 when you lead)
  gapToNext: number | null; // points to the entry one rank above (null when you lead)
}

// The standing at a given leaderboard index, with gaps relative to the leader
// and the entry one rank above.
function standingAt(leaderboard: LeaderboardLike[], idx: number): Standing {
  const me = leaderboard[idx];
  const leader = leaderboard[0];
  const live = (r: LeaderboardLike) => r.total + (r.projected ?? 0);

  // The entry one *rank* above — the nearest entry that ranks strictly higher,
  // not merely the row above (which may be tied with you and share your rank,
  // making "0 pts to the spot above" read as nonsense). The board is rank-
  // ordered, so walking back finds the nearest better-ranked entry.
  let above: LeaderboardLike | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (leaderboard[i].rank < me.rank) {
      above = leaderboard[i];
      break;
    }
  }

  return {
    rank: me.rank,
    entryId: me.entryId,
    label: me.label,
    total: live(me),
    entryCount: leaderboard.length,
    gapToLeader: live(leader) - live(me),
    gapToNext: above ? live(above) - live(me) : null,
  };
}

// Every standing the user owns in this pool, in leaderboard (rank) order — a user
// can hold more than one bracket. Empty when anonymous or unclaimed here.
export function buildStandings(
  leaderboard: LeaderboardLike[],
  userId: string | null,
): Standing[] {
  if (!userId) return [];
  const standings: Standing[] = [];
  leaderboard.forEach((r, idx) => {
    if (r.userId === userId) standings.push(standingAt(leaderboard, idx));
  });
  return standings;
}

// Your best (top-ranked) standing within the pool, or null if you have no
// (claimed) entry here.
export function buildStanding(
  leaderboard: LeaderboardLike[],
  userId: string | null,
): Standing | null {
  return buildStandings(leaderboard, userId)[0] ?? null;
}

// Match fields needed to choose what to surface as "up next".
export interface MatchLite {
  matchNo: number;
  roundCode: string;
  scheduledAt: Date | null;
  scored: boolean;
}

// The next match to surface: the soonest scheduled, not-yet-scored match; failing
// that (no upcoming schedule — e.g. pre-draw with null times), the lowest-numbered
// unscored match. null once every match is scored.
export function selectNextMatch(matches: MatchLite[], now: Date): MatchLite | null {
  const unscored = matches.filter((m) => !m.scored);
  if (unscored.length === 0) return null;

  const lowestUnscheduled = unscored
    .filter((m) => m.scheduledAt === null)
    .sort((a, b) => a.matchNo - b.matchNo)[0];
  const upcoming = unscored
    .filter((m) => m.scheduledAt !== null && m.scheduledAt.getTime() >= now.getTime())
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime());
  if (upcoming.length > 0) {
    if (lowestUnscheduled && lowestUnscheduled.matchNo < upcoming[0].matchNo) {
      return lowestUnscheduled;
    }
    return upcoming[0];
  }

  return [...unscored].sort((a, b) => a.matchNo - b.matchNo)[0];
}

export interface HomeLeader {
  label: string;
  total: number;
}

export interface HomeMover {
  entryId: string;
  label: string;
  pointsGained: number;
  rankDelta: number;
  currentRank: number;
}

export interface HomeNextMatch {
  matchNo: number;
  roundCode: string;
  scheduledAt: string | null; // ISO
  home: string | null; // team code, once known
  away: string | null;
  yourPick: { code: string; name: string } | null; // your winner pick (scored KO only)
  venue: string | null;
  city: string | null;
  cityToken: string | null;
  odds: ImpliedProbs | null; // pre-match win/draw/win, for the home scorecard parity bar
  daysAhead: number; // Eastern matchdays from now: 0 = today, 1 = tomorrow (drives the "Tomorrow" tag)
}

// Your headline numbers for the dashboard, drawn from your primary entry's
// profile. Null pre-tournament (nothing decided yet) or when you have no entry.
export interface HomeStats {
  accuracy: Accuracy;
  boldest: BoldestCall | null;
}

export interface HomeView {
  you: Standing | null; // your top-ranked entry
  otherEntries: Standing[]; // your remaining entries (multi-bracket)
  leader: HomeLeader | null;
  topMover: HomeMover | null;
  nextMatch: HomeNextMatch | null;
  liveMatches: MatchCenterRow[]; // matches in progress right now
  lastMatch: MatchCenterRow | null; // most recently finalised match
  stats: HomeStats | null;
  analytics: PickAnalytics | null; // pool-wide pick consensus (null pre-lock / empty)
  upsets: UpsetRow[]; // upcoming matches most likely to defy the favorite
}

// Fold a computed Mover + its label into the HomeMover shape.
export function toHomeMover(mover: Mover, label: string): HomeMover {
  return {
    entryId: mover.entryId,
    label,
    pointsGained: mover.pointsGained,
    rankDelta: mover.rankDelta,
    currentRank: mover.currentRank,
  };
}
