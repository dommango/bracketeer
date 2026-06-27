// Odds + scorer-board read queries, split out of lib/pool/queries.ts. Re-exported
// from there so callers keep importing from "@/lib/pool/queries".

import { prisma } from "@/lib/db";
import { matchPlayerCode } from "@/lib/odds/player-match";
import { teamName } from "./query-helpers";

export interface ChampionshipOdd {
  teamCode: string;
  name: string;
  winProb: number;
  decimal: number;
  fetchedAt: Date; // when this price was last polled (shown as an "Updated …" stamp)
}

// Tournament-winner futures, highest implied probability first. Empty when the
// outrights poll hasn't run (or the odds integration isn't configured).
export async function getChampionshipOdds(
  tournamentId: string,
  limit = 12,
): Promise<ChampionshipOdd[]> {
  const rows = await prisma.teamOutright.findMany({
    where: { tournamentId },
    orderBy: { winProb: "desc" },
    take: limit,
    select: { teamCode: true, winProb: true, decimal: true, fetchedAt: true },
  });
  return rows.map((r) => ({
    teamCode: r.teamCode,
    name: teamName(r.teamCode),
    winProb: r.winProb,
    decimal: r.decimal,
    fetchedAt: r.fetchedAt,
  }));
}

export interface TopScorerRow {
  rank: number;
  playerName: string;
  teamCode: string;
  teamName: string;
  goals: number;
  assists: number | null;
  appearances: number | null;
  fetchedAt: Date; // when the scorer board was last polled (shown as an "Updated …" stamp)
}

// The Golden Boot leaderboard, lowest rank first. Empty when the top-scorers poll
// hasn't run (or the sports integration isn't configured).
export async function getTopScorers(tournamentId: string, limit = 30): Promise<TopScorerRow[]> {
  const rows = await prisma.topScorer.findMany({
    where: { tournamentId },
    orderBy: { rank: "asc" },
    take: limit,
    select: {
      rank: true,
      playerName: true,
      teamCode: true,
      goals: true,
      assists: true,
      appearances: true,
      fetchedAt: true,
    },
  });
  return rows.map((r) => ({ ...r, teamName: teamName(r.teamCode) }));
}

export interface GoalscorerOdd {
  playerName: string;
  winProb: number;
  decimal: number;
  teamCode: string | null; // resolved from the top-scorer board when the name matches
  fetchedAt: Date; // when this price was last polled (shown as an "Updated …" stamp)
}

// Top-goalscorer (Golden Boot) futures, highest implied probability first. Each row
// is tagged with a team code when its player can be matched to the scoring board (for
// a flag) via the best-effort, never-guess matcher; unmatched names render without
// one. Empty when the market isn't polled (or the odds integration isn't configured
// / doesn't offer the market).
export async function getGoalscorerOutrights(
  tournamentId: string,
  limit = 12,
): Promise<GoalscorerOdd[]> {
  const [rows, board] = await Promise.all([
    prisma.goalscorerOutright.findMany({
      where: { tournamentId },
      orderBy: { winProb: "desc" },
      take: limit,
      select: { playerName: true, winProb: true, decimal: true, fetchedAt: true },
    }),
    prisma.topScorer.findMany({ where: { tournamentId }, select: { playerName: true, teamCode: true } }),
  ]);
  return rows.map((r) => ({
    playerName: r.playerName,
    winProb: r.winProb,
    decimal: r.decimal,
    teamCode: matchPlayerCode(r.playerName, board),
    fetchedAt: r.fetchedAt,
  }));
}
