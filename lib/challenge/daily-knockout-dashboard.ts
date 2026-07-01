// Read-model composition for the knockout Match Day Pick'em shell. Pure glue over
// existing read models — the knockout analogue of getMd3ChallengeHome. Ranks come
// from the knockout-only leaderboard, the viewer's decorated predictions from
// getDailyKnockoutView, and the by-round / by-day sub-boards from the pure
// daily-knockout-boards helpers.

import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import {
  getDailyKnockoutLeaderboard,
  getDailyKnockoutChampions,
  type KnockoutChampions,
} from "@/lib/challenge/leaderboard";
import { getDailyKnockoutView, type DailyKnockoutView } from "@/lib/pool/daily-knockout-view";
import { boardsByRound, boardsByDay, type BoardBucket } from "@/lib/challenge/daily-knockout-boards";
import { buildStanding, type Standing } from "@/lib/pool/home";
import type { LeaderboardRow } from "@/lib/pool/scoring";

export interface DailyKnockoutHome {
  standing: Standing | null; // the viewer's rank/gap on the knockout board
  board: LeaderboardRow[];
  view: DailyKnockoutView; // the viewer's decorated predictions + counts
  byRound: BoardBucket[]; // the viewer's per-round sub-boards (R32 → Final)
  byDay: BoardBucket[]; // the viewer's per-match-day sub-boards
  champions: KnockoutChampions; // cross-entry Round-Champion + Day-Winner crowns
}

export async function getDailyKnockoutHome(
  userId: string | null,
  now: Date = new Date(),
): Promise<DailyKnockoutHome> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [board, view, champions] = await Promise.all([
    getDailyKnockoutLeaderboard(),
    getDailyKnockoutView(tournamentId, userId, now),
    getDailyKnockoutChampions(),
  ]);
  return {
    standing: buildStanding(board, userId),
    board,
    view,
    byRound: boardsByRound(view),
    byDay: boardsByDay(view),
    champions,
  };
}
