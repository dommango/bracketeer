// Read-model composition for the Match Day Pickem challenge shell. Pure glue over
// existing read models — the public-board analogue of the pool Home view. No new
// scoring: ranks come from the MD3 challenge leaderboard, the viewer's decorated
// predictions from getMd3ChallengeView, and the live cards from the same 24 MD3
// match inputs the Matches tab uses.

import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getTournamentMatchInputs,
} from "@/lib/pool/queries";
import { getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { getMd3ChallengeView, type Md3View } from "@/lib/pool/md3-view";
import { buildStanding, type Standing } from "@/lib/pool/home";
import {
  buildGroupCenterSections,
  type MatchCenterSection,
  type YourScore,
} from "@/lib/pool/match-center";
import { buildScoreCardInputs, type ScoreCardInputs } from "@/lib/challenge/match-cards";
import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import type { LeaderboardRow } from "@/lib/pool/scoring";

export interface Md3ChallengeHome {
  standing: Standing | null; // the viewer's rank/gap, null until they complete all 24
  board: LeaderboardRow[];
  view: Md3View; // the viewer's decorated predictions + counts
  cards: ScoreCardInputs; // live / last / next, scoped to the 24 MD3 fixtures
}

// Everything the MD3 challenge Home page needs, composed in one place.
export async function getMd3ChallengeHome(
  userId: string | null,
  now: Date = new Date(),
): Promise<Md3ChallengeHome> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [board, view, inputs] = await Promise.all([
    getMd3ChallengeLeaderboard(),
    getMd3ChallengeView(tournamentId, userId, now),
    getTournamentMatchInputs(tournamentId, MD3_MATCH_NOS),
  ]);
  // The viewer's own scoreline predictions (and points once final), so the live /
  // last cards on Home show "your pick" beside the score like the Matches tab.
  const scorePicks: Record<number, YourScore> = {};
  for (const f of view.fixtures) {
    if (f.pred) scorePicks[f.matchNo] = { home: f.pred.home, away: f.pred.away, points: f.points };
  }

  return {
    standing: buildStanding(board, userId),
    board,
    view,
    cards: buildScoreCardInputs(inputs, {}, now, scorePicks),
  };
}

// The 24 final group-stage fixtures as a by-group match center, decorated with
// the viewer's own scoreline predictions (and points once final) so the Matches
// tab shows "your pick" beside every live/final score. MD3 has no per-match
// winner pick, so only the scoreline map is threaded in.
export async function getMd3MatchCenter(
  userId: string | null,
): Promise<MatchCenterSection[]> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [inputs, view] = await Promise.all([
    getTournamentMatchInputs(tournamentId, MD3_MATCH_NOS),
    getMd3ChallengeView(tournamentId, userId),
  ]);

  const scorePicks: Record<number, YourScore> = {};
  for (const f of view.fixtures) {
    // The viewer always sees their own picks fully revealed, so f.pred is safe.
    if (f.pred) scorePicks[f.matchNo] = { home: f.pred.home, away: f.pred.away, points: f.points };
  }

  return buildGroupCenterSections(inputs, {}, scorePicks);
}
