// Player drill-down data for the /pool/[code]/players/[name] page: the player's
// scoring-board line (rank/goals/assists/team), their per-goal log, and their
// Golden-Boot odds. The pure, unit-tested matching lives in player-goals.ts;
// this impure half binds it to prisma. Display only — does NOT touch lib/scoring.

import { prisma } from "@/lib/db";
import { normPlayer, matchPlayerCode, type BoardPlayer } from "@/lib/odds/player-match";
import { resolveBoardPlayer, buildPlayerGoals, type PlayerGoal } from "@/lib/pool/player-goals";
import { TEAMS } from "@/lib/scoring/data";

export interface PlayerDetail {
  name: string; // canonical scoring-board spelling when matched, else the input
  teamCode: string | null;
  teamName: string | null;
  rank: number | null;
  goals: number | null;
  assists: number | null;
  odds: { winProb: number; decimal: number } | null; // Golden-Boot market
  goalEvents: PlayerGoal[];
}

// One player's drill-down. Returns null when the name matches nothing the app
// knows about (no board line, no odds, no goals) so the route can 404.
export async function getPlayerDetail(
  tournamentId: string,
  name: string,
): Promise<PlayerDetail | null> {
  const target = normPlayer(name);
  if (!target) return null;

  const [board, oddsRows, goalRows] = await Promise.all([
    prisma.topScorer.findMany({
      where: { tournamentId },
      select: { rank: true, playerName: true, teamCode: true, goals: true, assists: true },
    }),
    prisma.goalscorerOutright.findMany({
      where: { tournamentId },
      select: { playerName: true, winProb: true, decimal: true },
    }),
    prisma.matchEvent.findMany({
      where: { type: { in: ["GOAL", "PENALTY_GOAL"] }, match: { tournamentId } },
      select: {
        playerName: true,
        type: true,
        minute: true,
        extraMinute: true,
        teamCode: true,
        match: {
          select: {
            matchNo: true,
            roundCode: true,
            result: { select: { homeTeamCode: true, awayTeamCode: true } },
          },
        },
      },
    }),
  ]);

  const boardPlayer = resolveBoardPlayer(name, board);
  const oddsRow = oddsRows.find((o) => normPlayer(o.playerName) === target) ?? null;
  const goalEvents = buildPlayerGoals(
    goalRows.map((e) => ({
      playerName: e.playerName,
      type: e.type,
      minute: e.minute,
      extraMinute: e.extraMinute,
      teamCode: e.teamCode,
      matchNo: e.match.matchNo,
      roundCode: e.match.roundCode,
      homeTeamCode: e.match.result?.homeTeamCode ?? null,
      awayTeamCode: e.match.result?.awayTeamCode ?? null,
    })),
    boardPlayer?.playerName ?? name,
  );

  if (!boardPlayer && !oddsRow && goalEvents.length === 0) return null;

  // Borrow a team code from the board when the name didn't line up exactly (the
  // never-guess matcher only returns one on an unambiguous surname).
  const teamCode =
    boardPlayer?.teamCode ??
    matchPlayerCode(name, board as BoardPlayer[]) ??
    goalEvents[0]?.teamCode ??
    null;

  return {
    name: boardPlayer?.playerName ?? oddsRow?.playerName ?? name,
    teamCode,
    teamName: teamCode ? (TEAMS[teamCode] ?? null) : null,
    rank: boardPlayer?.rank ?? null,
    goals: boardPlayer?.goals ?? (goalEvents.length > 0 ? goalEvents.length : null),
    assists: boardPlayer?.assists ?? null,
    odds: oddsRow ? { winProb: oddsRow.winProb, decimal: oddsRow.decimal } : null,
    goalEvents,
  };
}
