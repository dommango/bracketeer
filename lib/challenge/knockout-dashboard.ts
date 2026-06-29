// Read-model composition for the Knockout Challenge shell — the public-board
// analogue of the pool Home / Profile / Match-Center selectors, but keyed off the
// global challenge (Entry.enteredChallenge) instead of a pool. Pure glue over
// existing read models; no new scoring. The profile selector is the poolId-free
// twin of queries.getProfile (which hard-filters on poolId), and reuses the same
// eligibility filter as the challenge leaderboard so incomplete brackets never
// leak onto the public board.

import { prisma } from "@/lib/db";
import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getTournamentMatchInputs,
  getKnockoutState,
  getChallengeMatchDetail,
  type MatchDetail,
} from "@/lib/pool/queries";
import { buildPickSplit } from "@/lib/pool/pick-split";
import { teamName } from "@/lib/pool/query-helpers";
import {
  getChallengeEntriesWithPicks,
  getChallengeKnockoutProjection,
} from "@/lib/challenge/analytics";
import { getChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { buildStanding, type Standing } from "@/lib/pool/home";
import { buildMatchCenter, type MatchCenterSection } from "@/lib/pool/match-center";
import { buildScoreCardInputs, type ScoreCardInputs } from "@/lib/challenge/match-cards";
import { type MatchUpdate } from "@/lib/challenge/match-updates";
import { getRecentTournamentUpdates, BOARD_MATCH_NOS } from "@/lib/challenge/recent-updates";
import { buildProfile, tallyPickShare, type Profile } from "@/lib/pool/profile";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { asResults, type LeaderboardRow } from "@/lib/pool/scoring";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { isKnockoutEntryComplete } from "@/lib/challenge/eligibility";
import { getUserBrackets, type BracketSummary } from "@/lib/bracket/gallery";

// The knockout + bronze matches (73–104) — the scope of the Knockout Challenge.
const KNOCKOUT_MATCH_NOS: readonly number[] = Array.from({ length: 104 - 73 + 1 }, (_, i) => 73 + i);

// The viewer's per-match knockout winner picks, from their most relevant knockout
// entry (prefer one already in the challenge, then the highest-scoring). Empty for
// anonymous viewers or viewers with no knockout bracket. Mirrors queries'
// getEntryKnockoutPicks but keyed by user across the whole tournament, not a pool.
async function getChallengeEntryKnockoutPicks(
  userId: string | null,
  tournamentId: string,
): Promise<Record<number, string>> {
  if (!userId) return {};
  const entry = await prisma.entry.findFirst({
    where: { userId, tournamentId, format: "KNOCKOUT" },
    orderBy: [{ enteredChallenge: "desc" }, { breakdown: { totalPoints: "desc" } }],
    select: { picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } } },
  });
  if (!entry) return {};
  return pickRowsToSubmission(entry.picks).picks.knockout ?? {};
}

export interface KnockoutChallengeHome {
  standing: Standing | null; // null until the viewer has a complete, entered bracket
  board: LeaderboardRow[];
  cards: ScoreCardInputs; // live / last / next, scoped to the knockout matches
  myBrackets: BracketSummary[]; // the viewer's knockout brackets (for the "your bracket" CTA)
  updates: MatchUpdate[]; // recent updates across the shared board (identical to MD3 home)
  open: boolean; // picks open (the field is set)
  earlyOpen: boolean; // early projected-fill available before the field is set
  opensAt: Date;
  locksAt: Date | null;
}

export async function getKnockoutChallengeHome(
  userId: string | null,
  now: Date = new Date(),
): Promise<KnockoutChallengeHome> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [board, inputs, picks, knockoutState, myBrackets, updates] = await Promise.all([
    getChallengeLeaderboard(),
    getTournamentMatchInputs(tournamentId, BOARD_MATCH_NOS),
    getChallengeEntryKnockoutPicks(userId, tournamentId),
    getKnockoutState(tournamentId),
    userId ? getUserBrackets(userId, tournamentId) : Promise.resolve([]),
    getRecentTournamentUpdates(tournamentId, 3),
  ]);

  return {
    standing: buildStanding(board, userId),
    board,
    cards: buildScoreCardInputs(inputs, picks, now),
    myBrackets: myBrackets.filter((b) => b.format === "KNOCKOUT"),
    updates,
    open: knockoutState.open,
    earlyOpen: knockoutState.earlyOpen,
    opensAt: knockoutState.opensAt,
    locksAt: knockoutState.locksAt,
  };
}

// The knockout match center (matches 73+), with the viewer's winner picks marked.
export async function getKnockoutChallengeMatchCenter(
  userId: string | null,
): Promise<MatchCenterSection[]> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [inputs, picks] = await Promise.all([
    getTournamentMatchInputs(tournamentId, KNOCKOUT_MATCH_NOS),
    getChallengeEntryKnockoutPicks(userId, tournamentId),
  ]);
  return buildMatchCenter(inputs, picks);
}

// One knockout match's detail for the public challenge: the tournament-generic
// detail plus the challenge field's pick-split (scored knockout matches only) and
// the viewer's own pick. The poolId-free twin of getMatchDetail; md3 keeps using
// getChallengeMatchDetail directly (no winner pick-split).
export async function getChallengeKnockoutMatchDetail(
  matchNo: number,
  userId: string | null,
): Promise<MatchDetail | null> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const detail = await getChallengeMatchDetail(tournamentId, matchNo);
  if (!detail || !detail.scored) return detail;

  const [entries, mine] = await Promise.all([
    getChallengeEntriesWithPicks(tournamentId),
    getChallengeEntryKnockoutPicks(userId, tournamentId),
  ]);
  const pickSplit = buildPickSplit(
    detail.home.code,
    detail.away.code,
    entries.map((e) => e.picks.knockout?.[matchNo]),
  );
  const code = mine[matchNo];
  const yourPick = code
    ? { code, name: teamName(code), correct: detail.winnerCode ? code === detail.winnerCode : null }
    : null;

  return { ...detail, pickSplit, yourPick };
}

// A single challenge bracket's profile — the poolId-free analogue of getProfile.
// Returns null unless the entry is on the public board (KNOCKOUT, opted in, and a
// complete/valid bracket), so an incomplete or un-entered bracket can't be viewed.
export async function getKnockoutChallengeProfile(entryId: string): Promise<Profile | null> {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const [board, tournament, entries, knockoutState, projection] = await Promise.all([
    getChallengeLeaderboard(),
    prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { officialResults: true },
    }),
    prisma.entry.findMany({
      where: { tournamentId, format: "KNOCKOUT", enteredChallenge: true },
      select: {
        id: true,
        label: true,
        breakdown: { select: { byCategory: true } },
        picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
      },
    }),
    getKnockoutState(tournamentId),
    getChallengeKnockoutProjection(tournamentId),
  ]);

  // Same eligibility filter as the public leaderboard — only complete & valid
  // brackets are materialized, so the profile can't leak an incomplete one.
  const eligible = entries.filter((e) => {
    try {
      return isKnockoutEntryComplete(pickRowsToSubmission(e.picks).picks);
    } catch {
      return false;
    }
  });
  const entry = eligible.find((e) => e.id === entryId);
  if (!entry) return null;

  const row = board.find((r) => r.entryId === entryId);
  const projected = row?.projected ?? 0;

  const projectionRow = projection.hasData
    ? projection.rows.find((r) => r.entryId === entryId)
    : undefined;
  const entryProjection = projectionRow
    ? {
        expectedRemaining: projectionRow.expectedRemaining,
        projectedTotal: projectionRow.projectedTotal,
        projectedRank: projectionRow.projectedRank,
      }
    : null;

  return buildProfile({
    entryId: entry.id,
    label: entry.label,
    total: (row?.total ?? 0) + projected,
    projected: projected > 0 ? projected : undefined,
    rank: row?.rank ?? Math.max(1, board.length),
    entryCount: board.length,
    picks: pickRowsToSubmission(entry.picks).picks,
    results: asResults(tournament.officialResults),
    breakdown: (entry.breakdown?.byCategory as Record<string, number> | null) ?? null,
    pickShareByMatch: tallyPickShare(eligible.map((e) => pickRowsToSubmission(e.picks).picks)),
    locked: isKnockoutLocked(knockoutState.locksAt),
    projection: entryProjection,
  });
}
