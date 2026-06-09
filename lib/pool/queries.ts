// Read helpers for rendering pool pages.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getLeaderboard, asResults, type LeaderboardRow } from "@/lib/pool/scoring";
import { buildBracketView, type BracketView, type MatchScore } from "@/lib/pool/bracket-view";
import { computeMovers, type SnapshotPoint, type Mover } from "@/lib/pool/movers";

// The WC2026 MVP runs a single tournament; admin routes default to it but accept
// an explicit slug so the same code serves future multi-tenant tournaments.
export const DEFAULT_TOURNAMENT_SLUG = "wc2026";

export async function getTournamentIdBySlug(
  slug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<string> {
  const t = await prisma.tournament.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  return t.id;
}

// Memoized per request so the pool layout and its child route page share one
// lookup instead of querying twice on every navigation.
export const getPoolByCode = cache(async (code: string) => {
  return prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { tournament: true },
  });
});

export interface PoolHeader {
  id: string;
  name: string;
  joinCode: string;
  tournamentName: string;
  tournamentStatus: string;
  entryCount: number;
}

// Lightweight header data for the shared pool layout — avoids recomputing the
// full leaderboard just to render the hero (the table route does that itself).
export async function getPoolHeader(code: string): Promise<PoolHeader | null> {
  const pool = await getPoolByCode(code);
  if (!pool) return null;
  const entryCount = await prisma.entry.count({ where: { poolId: pool.id } });
  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    tournamentName: pool.tournament.name,
    tournamentStatus: pool.tournament.status,
    entryCount,
  };
}

export interface PoolView {
  id: string;
  name: string;
  joinCode: string;
  tournamentName: string;
  tournamentStatus: string;
  leaderboard: LeaderboardRow[];
}

export async function getPoolView(code: string): Promise<PoolView | null> {
  const pool = await getPoolByCode(code);
  if (!pool) return null;
  const leaderboard = await getLeaderboard(pool.id);
  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    tournamentName: pool.tournament.name,
    tournamentStatus: pool.tournament.status,
    leaderboard,
  };
}

// The live bracket + group standings for a pool's tournament, built from the
// official answer key and per-match display scores.
export async function getPoolBracket(poolId: string): Promise<BracketView | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournament: { select: { id: true, officialResults: true } } },
  });
  if (!pool) return null;

  const resultRows = await prisma.result.findMany({
    where: { match: { tournamentId: pool.tournament.id } },
    select: { homeScore: true, awayScore: true, match: { select: { matchNo: true } } },
  });
  const scores = new Map<number, MatchScore>(
    resultRows.map((r) => [r.match.matchNo, { homeScore: r.homeScore, awayScore: r.awayScore }]),
  );

  return buildBracketView(asResults(pool.tournament.officialResults), scores);
}

// Movers over a window: for each entry, the delta between its standing at `since`
// (its latest snapshot at-or-before that time) and its current standing (its
// latest snapshot overall). Ranking is the pure computeMovers; this layer only
// reads the history and folds it into baseline/current maps.
export async function getMovers(poolId: string, since: Date): Promise<Mover[]> {
  const snaps = await prisma.scoreSnapshot.findMany({
    where: { poolId },
    orderBy: { capturedAt: "asc" },
    select: { entryId: true, totalPoints: true, rank: true, capturedAt: true },
  });

  const baseline = new Map<string, SnapshotPoint>();
  const current = new Map<string, SnapshotPoint>();
  for (const s of snaps) {
    const p: SnapshotPoint = { entryId: s.entryId, totalPoints: s.totalPoints, rank: s.rank };
    current.set(s.entryId, p); // ascending order → last write wins = latest standing
    if (s.capturedAt <= since) baseline.set(s.entryId, p); // latest at-or-before `since`
  }

  return computeMovers(baseline, [...current.values()]);
}
