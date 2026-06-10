// Read helpers for rendering pool pages.

import { prisma } from "@/lib/db";
import {
  getLeaderboard,
  asResults,
  asScoringConfig,
  type LeaderboardRow,
} from "@/lib/pool/scoring";
import { buildBracketView, type BracketView, type MatchScore } from "@/lib/pool/bracket-view";
import type { Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";

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

export async function getPoolByCode(code: string) {
  return prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { tournament: true },
  });
}

// A pool's tournament answer key + scoring config, coerced into engine shapes.
// Shared by the read-only insight features (pick-split, profiles, compare).
export async function getPoolAnswerKey(
  poolId: string,
): Promise<{ results: Results; cfg: ScoringConfig } | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournament: { select: { officialResults: true, scoringConfig: true } } },
  });
  if (!pool) return null;
  return {
    results: asResults(pool.tournament.officialResults),
    cfg: asScoringConfig(pool.tournament.scoringConfig),
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
