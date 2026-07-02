// Read-model composition for the knockout Match Day Pick'em shell. Pure glue over
// existing read models — the knockout analogue of getMd3ChallengeHome. Ranks come
// from the knockout-only leaderboard, the viewer's decorated predictions from
// getDailyKnockoutView, and the by-round / by-day sub-boards from the pure
// daily-knockout-boards helpers.

import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getTournamentMatchInputs,
} from "@/lib/pool/queries";
import {
  getDailyKnockoutLeaderboard,
  getDailyKnockoutChampions,
  type KnockoutChampions,
} from "@/lib/challenge/leaderboard";
import { getDailyKnockoutView, type DailyKnockoutView } from "@/lib/pool/daily-knockout-view";
import { boardsByRound, boardsByDay, type BoardBucket } from "@/lib/challenge/daily-knockout-boards";
import { dailyKnockoutScorePicks } from "@/lib/challenge/md3-dashboard";
import { buildScoreCardInputs, type ScoreCardInputs } from "@/lib/challenge/match-cards";
import { BOARD_MATCH_NOS } from "@/lib/challenge/recent-updates";
import { buildStanding, type Standing } from "@/lib/pool/home";
import type { LeaderboardRow } from "@/lib/pool/scoring";

export interface DailyKnockoutHome {
  standing: Standing | null; // the viewer's rank/gap on the knockout board
  board: LeaderboardRow[];
  view: DailyKnockoutView; // the viewer's decorated predictions + counts
  cards: ScoreCardInputs; // live / last / next across the shared board (same scope as knockout home)
  byRound: BoardBucket[]; // the viewer's per-round sub-boards (R32 → Final)
  byDay: BoardBucket[]; // the viewer's per-match-day sub-boards
  champions: KnockoutChampions; // cross-entry Round-Champion + Day-Winner crowns
}

export async function getDailyKnockoutHome(
  userId: string | null,
  now: Date = new Date(),
): Promise<DailyKnockoutHome> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [board, view, champions, inputs] = await Promise.all([
    getDailyKnockoutLeaderboard(),
    getDailyKnockoutView(tournamentId, userId, now),
    getDailyKnockoutChampions(),
    getTournamentMatchInputs(tournamentId, BOARD_MATCH_NOS),
  ]);
  // The viewer's own scoreline predictions (and points once final), oriented onto
  // each card so the live / last cards show "your pick" beside the score. The
  // stale-LIVE guard lives in buildScoreCardInputs, so it isn't duplicated here.
  const scorePicks = dailyKnockoutScorePicks(inputs, view);
  return {
    standing: buildStanding(board, userId),
    board,
    view,
    cards: buildScoreCardInputs(inputs, {}, now, scorePicks),
    byRound: boardsByRound(view),
    byDay: boardsByDay(view),
    champions,
  };
}
