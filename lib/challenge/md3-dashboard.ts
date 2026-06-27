// Read-model composition for the Match Day Pickem challenge shell. Pure glue over
// existing read models — the public-board analogue of the pool Home view. No new
// scoring: ranks come from the MD3 challenge leaderboard, the viewer's decorated
// predictions from getMd3ChallengeView, and the live cards from the same 24 MD3
// match inputs the Matches tab uses.

import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getTournamentMatchInputs,
  getTournamentBracket,
} from "@/lib/pool/queries";
import { getRecentTournamentUpdates, BOARD_MATCH_NOS } from "@/lib/challenge/recent-updates";
import { getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { getMd3ChallengeView, type Md3View } from "@/lib/pool/md3-view";
import { buildStanding, type Standing } from "@/lib/pool/home";
import {
  buildGroupCenterSections,
  orientScorePrediction,
  type MatchCenterSection,
  type MatchInput,
  type YourScore,
} from "@/lib/pool/match-center";
import type { BracketView } from "@/lib/pool/bracket-view";
import { buildScoreCardInputs, type ScoreCardInputs } from "@/lib/challenge/match-cards";
import { type MatchUpdate } from "@/lib/challenge/match-updates";
import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import type { LeaderboardRow } from "@/lib/pool/scoring";

export interface Md3ChallengeHome {
  standing: Standing | null; // the viewer's rank/gap, null until they complete all 24
  board: LeaderboardRow[];
  view: Md3View; // the viewer's decorated predictions + counts
  cards: ScoreCardInputs; // live / last / next across the shared board (MD3 + knockout)
  updates: MatchUpdate[]; // recent updates across the shared board (identical to knockout home)
}

// The viewer's MD3 scoreline predictions, keyed by matchNo and oriented onto each
// match card. Cards render teams in the inputs' (live Result row) orientation,
// which can differ from the fixture's canonical draw orientation at neutral venues,
// so we re-key by team code — otherwise the scoreline reads transposed vs the
// labels (a 3–0 pick shown as 0–3).
function md3ScorePicks(inputs: MatchInput[], view: Md3View): Record<number, YourScore> {
  const inputByNo = new Map(inputs.map((i) => [i.matchNo, i]));
  const scorePicks: Record<number, YourScore> = {};
  for (const f of view.fixtures) {
    // The viewer always sees their own picks fully revealed, so f.pred is safe.
    if (!f.pred) continue;
    const input = inputByNo.get(f.matchNo);
    const oriented = orientScorePrediction(
      f.pred,
      f.homeCode,
      f.awayCode,
      input?.homeCode ?? f.homeCode,
      input?.awayCode ?? f.awayCode,
    );
    scorePicks[f.matchNo] = { home: oriented.home, away: oriented.away, points: f.points };
  }
  return scorePicks;
}

// Everything the MD3 challenge Home page needs, composed in one place.
export async function getMd3ChallengeHome(
  userId: string | null,
  now: Date = new Date(),
): Promise<Md3ChallengeHome> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [board, view, inputs, updates] = await Promise.all([
    getMd3ChallengeLeaderboard(),
    getMd3ChallengeView(tournamentId, userId, now),
    getTournamentMatchInputs(tournamentId, BOARD_MATCH_NOS),
    getRecentTournamentUpdates(tournamentId, 3),
  ]);
  // The viewer's own scoreline predictions (and points once final), oriented to
  // each card so the live / last cards on Home show "your pick" beside the score
  // like the Matches tab.
  const scorePicks = md3ScorePicks(inputs, view);

  return {
    standing: buildStanding(board, userId),
    board,
    view,
    cards: buildScoreCardInputs(inputs, {}, now, scorePicks),
    updates,
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
  return buildGroupCenterSections(inputs, {}, md3ScorePicks(inputs, view));
}

// The full tournament match center (all 104 matches: every group + knockout
// fixture) with the viewer's MD3 scoreline overlay where they predicted. Powers
// the challenge Matches tab's pool-parity view (group fixtures + the bracket).
export async function getMd3FullMatchCenter(
  userId: string | null,
): Promise<MatchCenterSection[]> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [inputs, view] = await Promise.all([
    getTournamentMatchInputs(tournamentId),
    getMd3ChallengeView(tournamentId, userId),
  ]);
  return buildGroupCenterSections(inputs, {}, md3ScorePicks(inputs, view));
}

// The tournament's live bracket + group standings, for the challenge Matches tab.
export async function getMd3Bracket(): Promise<BracketView | null> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  return getTournamentBracket(tournamentId);
}
