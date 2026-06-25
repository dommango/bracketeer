// The public Bracketeer Knockout Challenge leaderboard: every knockout bracket
// whose owner has opted in (Entry.enteredChallenge), ranked together — across
// pooled and standalone brackets alike. Reads ONLY opted-in entries — brackets
// that haven't entered are never materialized here, so their picks/scores can't
// leak onto the public board — then overlays the same display-only live knockout
// projection the pool leaderboard uses and re-ranks 1..N.

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { asScoringConfig, type LeaderboardRow } from "@/lib/pool/scoring";
import { rankEnteredRows } from "@/lib/challenge/rank-entered";
import { liveLeaders, projectedLivePoints } from "@/lib/pool/projected";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { decodeMd3Rows, type Md3Scores } from "@/lib/pool/md3-picks";
import { md3Fixtures, MD3_MATCH_NOS, scoreMd3 } from "@/lib/pool/match-day-3";
import { isKnockoutEntryComplete } from "@/lib/challenge/eligibility";

// Knockout pick rows carry the match id in their CSV-mirrored category ("M73").
const KNOCKOUT_PICK_SECTIONS = [
  "round_of_32",
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "final",
];

export async function getChallengeLeaderboard(
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<LeaderboardRow[]> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);

  const entries = await prisma.entry.findMany({
    where: { tournamentId, format: "KNOCKOUT", enteredChallenge: true },
    select: {
      id: true,
      label: true,
      userId: true,
      tiebreak: true,
      breakdown: { select: { totalPoints: true, byCategory: true } },
      picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
      user: { select: { emailVerified: true } },
    },
  });
  // Prize/board eligibility: a complete & valid bracket owned by a verified-email
  // account. The verified-email gate (anti-Sybil) governs both the public board
  // and prize selection — an incomplete or unverified entry is never materialized.
  const eligible = entries.filter((e) => {
    if (!e.userId || !e.user?.emailVerified) return false;
    try {
      return isKnockoutEntryComplete(pickRowsToSubmission(e.picks).picks);
    } catch {
      return false;
    }
  });
  if (eligible.length === 0) return [];

  const rows: LeaderboardRow[] = eligible.map((e) => ({
    rank: 0,
    entryId: e.id,
    label: e.label,
    userId: e.userId,
    total: e.breakdown?.totalPoints ?? 0,
    breakdown: e.breakdown?.byCategory ?? null,
    tiebreak: e.tiebreak,
  }));

  const withLive = await overlayLiveProjection(
    tournamentId,
    rows,
    eligible.map((e) => e.id),
  );

  // rankEnteredRows filters by id-set then ranks; passing every row's id makes
  // the filter a no-op and reuses its (unit-tested) live-total competition rank.
  return rankEnteredRows(withLive, new Set(rows.map((r) => r.entryId)));
}

// Add display-only projected live points to the entered rows from any live
// knockout match, scoped to these entries' picks only. Mirrors the pool's
// withProjectedPoints knockout branch; group provisional points don't apply
// (the Challenge is knockout-only, so entries hold no group picks).
async function overlayLiveProjection(
  tournamentId: string,
  rows: LeaderboardRow[],
  enteredIds: string[],
): Promise<LeaderboardRow[]> {
  const liveRows = await prisma.result.findMany({
    where: { status: "LIVE", match: { tournamentId } },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      status: true,
      match: { select: { matchNo: true } },
    },
  });
  const leaders = liveLeaders(liveRows.map((r) => ({ ...r, matchNo: r.match.matchNo })));
  if (leaders.length === 0) return rows;

  const pickRows = await prisma.pick.findMany({
    where: { entryId: { in: enteredIds }, section: { in: KNOCKOUT_PICK_SECTIONS } },
    select: { entryId: true, category: true, code: true },
  });
  const picksByEntry = new Map<string, Record<number, string>>();
  for (const p of pickRows) {
    if (!p.code) continue;
    const matchNo = Number(p.category.replace(/^M/i, ""));
    if (!Number.isInteger(matchNo)) continue;
    const entry = picksByEntry.get(p.entryId) ?? {};
    entry[matchNo] = p.code;
    picksByEntry.set(p.entryId, entry);
  }

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { scoringConfig: true },
  });
  const projected = projectedLivePoints(leaders, picksByEntry, asScoringConfig(tournament.scoringConfig));

  return rows.map((r) => {
    const pts = projected.get(r.entryId) ?? 0;
    return pts > 0 ? { ...r, projected: pts } : r;
  });
}

// Display-only projected MD3 points from any LIVE final-group-stage match: score
// each entry's scoreline prediction against the in-progress live score (oriented
// to the fixture's canonical home/away), exactly as a final result would score.
// Mirrors the knockout board's overlayLiveProjection — the cached total (refreshed
// on FINAL) never includes a still-live match, so this is purely additive and
// hands off seamlessly when the match goes final.
async function overlayMd3LiveProjection(
  tournamentId: string,
  rows: LeaderboardRow[],
  predsByEntry: Map<string, Md3Scores>,
): Promise<LeaderboardRow[]> {
  const liveRows = await prisma.result.findMany({
    where: { status: "LIVE", match: { tournamentId, matchNo: { in: [...MD3_MATCH_NOS] } } },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      match: { select: { matchNo: true } },
    },
  });
  if (liveRows.length === 0) return rows;

  // matchNo -> live score oriented to the fixture's canonical home/away (the
  // orientation predictions are stored in), so scoreMd3 compares like for like.
  const fixturesByNo = new Map(md3Fixtures().map((f) => [f.matchNo, f]));
  const liveByNo = new Map<number, { home: number; away: number }>();
  for (const r of liveRows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore === null || r.awayScore === null) continue;
    const f = fixturesByNo.get(r.match.matchNo);
    if (!f) continue;
    const byTeam: Record<string, number> = {
      [r.homeTeamCode]: r.homeScore,
      [r.awayTeamCode]: r.awayScore,
    };
    const home = byTeam[f.homeCode];
    const away = byTeam[f.awayCode];
    if (home === undefined || away === undefined) continue;
    liveByNo.set(f.matchNo, { home, away });
  }
  if (liveByNo.size === 0) return rows;

  return rows.map((r) => {
    const preds = predsByEntry.get(r.entryId);
    if (!preds) return r;
    let pts = 0;
    for (const [no, actual] of liveByNo) {
      const pred = preds[no];
      if (pred) pts += scoreMd3(pred, actual);
    }
    return pts > 0 ? { ...r, projected: pts } : r;
  });
}

// The public Match Day 3 Pickem challenge board: every MD3 entry whose owner has
// opted in (Entry.enteredChallenge) across all MD3 pools for the tournament,
// ranked together. Mirrors the knockout board: cached MD3 ScoreBreakdown
// (refreshed on each FINAL result via scoreMd3Pool) plus a display-only live
// projection for any in-progress MD3 fixture. Eligibility: only complete brackets
// (all 24 fixtures predicted) count toward the board / prize.
export async function getMd3ChallengeLeaderboard(
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<LeaderboardRow[]> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);

  const entries = await prisma.entry.findMany({
    where: { tournamentId, format: "MATCH_DAY_3_PICKEM", enteredChallenge: true },
    select: {
      id: true,
      label: true,
      userId: true,
      tiebreak: true,
      breakdown: { select: { totalPoints: true, byCategory: true } },
      picks: { select: { category: true, key: true, teamOrValue: true } },
      user: { select: { emailVerified: true } },
    },
  });

  // Verified-email gate (anti-Sybil), same as the knockout board. An entry shows
  // as soon as its sheet is saved — it does NOT need all 24 fixtures predicted;
  // its points reflect whichever fixtures it predicted and that have gone final.
  // We still require at least one prediction so blank, never-played entries don't
  // clutter the board.
  const eligible = entries.filter(
    (e) =>
      Boolean(e.userId) &&
      Boolean(e.user?.emailVerified) &&
      Object.keys(decodeMd3Rows(e.picks)).length > 0,
  );
  if (eligible.length === 0) return [];

  const rows: LeaderboardRow[] = eligible.map((e) => ({
    rank: 0,
    entryId: e.id,
    label: e.label,
    userId: e.userId,
    total: e.breakdown?.totalPoints ?? 0,
    breakdown: e.breakdown?.byCategory ?? null,
    tiebreak: e.tiebreak,
  }));

  const withLive = await overlayMd3LiveProjection(
    tournamentId,
    rows,
    new Map(eligible.map((e) => [e.id, decodeMd3Rows(e.picks)])),
  );

  // rankEnteredRows filters by id-set then ranks; passing every row's id makes
  // the filter a no-op and reuses its unit-tested competition rank.
  return rankEnteredRows(withLive, new Set(rows.map((r) => r.entryId)));
}
