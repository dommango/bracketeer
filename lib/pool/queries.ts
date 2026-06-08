// Read helpers for rendering pool pages.

import { prisma } from "@/lib/db";
import { getLeaderboard, type LeaderboardRow } from "@/lib/pool/scoring";

export async function getPoolByCode(code: string) {
  return prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { tournament: true },
  });
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
