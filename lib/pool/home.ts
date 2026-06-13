// Pure Home-dashboard logic + the HomeView contract. The standing-gap math and
// next-match selection are DB-free so they're unit-testable; the prisma
// aggregator (getHomeView) lives in queries.ts and fills these shapes.

import type { Mover } from "@/lib/pool/movers";

// A leaderboard row reduced to what the standing card needs.
export interface LeaderboardLike {
  rank: number;
  entryId: string;
  label: string;
  userId: string | null;
  total: number;
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

// Your standing within the pool, or null if the user has no (claimed) entry here.
export function buildStanding(
  leaderboard: LeaderboardLike[],
  userId: string | null,
): Standing | null {
  if (!userId) return null;
  const idx = leaderboard.findIndex((r) => r.userId === userId);
  if (idx === -1) return null;

  const me = leaderboard[idx];
  const leader = leaderboard[0];
  const above = idx > 0 ? leaderboard[idx - 1] : null;

  return {
    rank: me.rank,
    entryId: me.entryId,
    label: me.label,
    total: me.total,
    entryCount: leaderboard.length,
    gapToLeader: leader.total - me.total,
    gapToNext: above ? above.total - me.total : null,
  };
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
}

export interface HomeView {
  you: Standing | null;
  leader: HomeLeader | null;
  topMover: HomeMover | null;
  nextMatch: HomeNextMatch | null;
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
