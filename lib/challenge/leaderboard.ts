// The public Bracketeer Knockout Challenge leaderboard: every knockout bracket
// whose owner has opted in (Entry.enteredChallenge), ranked together — across
// pooled and standalone brackets alike. Reads ONLY opted-in entries — brackets
// that haven't entered are never materialized here, so their picks/scores can't
// leak onto the public board — then overlays the same display-only live knockout
// projection the pool leaderboard uses and re-ranks 1..N.

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { asScoringConfig, asResults, type LeaderboardRow } from "@/lib/pool/scoring";
import { rankEnteredRows } from "@/lib/challenge/rank-entered";
import { parseMd3Tiebreak } from "@/lib/challenge/md3-tiebreak";
import { liveLeaders, projectedLivePoints } from "@/lib/pool/projected";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { decodeMd3Rows, type Md3Scores } from "@/lib/pool/md3-picks";
import { md3Fixtures, MD3_MATCH_NOS, scoreMd3 } from "@/lib/pool/match-day-3";
import { isKnockoutEntryComplete } from "@/lib/challenge/eligibility";
import { publicLabel } from "@/lib/challenge/public-label";
import { knockoutDailyFixtures } from "@/lib/games/daily-pickem/fixtures";
import { decodeDailyKnockoutByTeam } from "@/lib/games/daily-pickem/picks";
import { scoreDailyKnockout } from "@/lib/games/daily-pickem/score-knockout";
import { DAILY_KNOCKOUT_MATCH_NOS, DAILY_KNOCKOUT_SECTION } from "@/lib/games/daily-pickem/scope";
import {
  knockoutLadderTotal,
  ladderPointsByRound,
  ladderPointsByDay,
  perfectEligibleDays,
  roundWeight,
  STAGE_ORDER,
  type PerfectEligibleDay,
} from "@/lib/games/daily-pickem/ladder";
import type { Stage } from "@/lib/games/stage";

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
      user: { select: { emailVerified: true, name: true, challengeDisplayName: true } },
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
    // Resolve the public display name from the account (challenge name → account
    // name → a stable anonymous handle), not the stored Entry.label, so an entry
    // saved before the user had a name doesn't show the generic "Player".
    label: publicLabel(e.user?.challengeDisplayName ?? e.user?.name, e.userId!),
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
      user: { select: { emailVerified: true, name: true, challengeDisplayName: true } },
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
    // Public display name from the account (challenge name → account name → a
    // stable anonymous handle), not the stored Entry.label.
    label: publicLabel(e.user?.challengeDisplayName ?? e.user?.name, e.userId!),
    userId: e.userId,
    total: e.breakdown?.totalPoints ?? 0,
    breakdown: e.breakdown?.byCategory ?? null,
    tiebreak: e.tiebreak,
    // Quality-cascade tiebreak cached at scoring time; makes equal-point entries
    // rank decisively instead of sharing a place (see lib/challenge/md3-tiebreak).
    md3Tiebreak: parseMd3Tiebreak(e.breakdown?.byCategory),
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

// Coerce a stored perPick JSON blob into a { "M{no}": points } map.
function asPerPick(perPick: unknown): Record<string, number> {
  if (!perPick || typeof perPick !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(perPick as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

interface KnockoutBoardEntry {
  id: string;
  userId: string;
  label: string;
  perPick: Record<string, number>;
  picks: {
    section: string;
    category: string;
    key: string;
    code: string;
    teamOrValue: string;
  }[];
}

// The eligible entries for the knockout board: opted-in MATCH_DAY_3_PICKEM entries
// with ≥1 knockout pick and a verified-email owner (anti-Sybil). Shared by the
// leaderboard and the champions computation so they can't disagree on the field.
async function loadKnockoutBoardEntries(tournamentId: string): Promise<KnockoutBoardEntry[]> {
  const entries = await prisma.entry.findMany({
    where: {
      tournamentId,
      format: "MATCH_DAY_3_PICKEM",
      enteredChallenge: true,
      picks: { some: { section: DAILY_KNOCKOUT_SECTION } },
    },
    select: {
      id: true,
      userId: true,
      breakdown: { select: { perPick: true } },
      picks: {
        where: { section: DAILY_KNOCKOUT_SECTION },
        select: { section: true, category: true, key: true, code: true, teamOrValue: true },
      },
      user: { select: { emailVerified: true, name: true, challengeDisplayName: true } },
    },
  });
  return entries
    .filter((e) => Boolean(e.userId) && Boolean(e.user?.emailVerified))
    .map((e) => ({
      id: e.id,
      userId: e.userId!,
      label: publicLabel(e.user?.challengeDisplayName ?? e.user?.name, e.userId!),
      perPick: asPerPick(e.breakdown?.perPick),
      picks: e.picks,
    }));
}

// The match numbers of every FINAL knockout result — the Perfect-Day eligibility
// input (a day counts once all its fixtures are final).
async function loadFinalKnockoutMatchNos(tournamentId: string): Promise<Set<number>> {
  const rows = await prisma.result.findMany({
    where: { status: "FINAL", match: { tournamentId, matchNo: { in: [...DAILY_KNOCKOUT_MATCH_NOS] } } },
    select: { match: { select: { matchNo: true } } },
  });
  return new Set(rows.map((r) => r.match.matchNo));
}

// Display-only projected LADDER points from any LIVE knockout match: score each
// entry's scoreline prediction against the in-progress live score (oriented by team
// code), then weight it by the match's round — exactly how the cached ladder total
// will grow when the match goes final. No advancement bonus until an official winner
// is set. Mirrors overlayMd3LiveProjection, but round-weighted for the ladder.
async function overlayDailyKnockoutLiveProjection(
  tournamentId: string,
  rows: LeaderboardRow[],
  picksByEntry: Map<string, ReturnType<typeof decodeDailyKnockoutByTeam>>,
): Promise<LeaderboardRow[]> {
  const liveRows = await prisma.result.findMany({
    where: { status: "LIVE", match: { tournamentId, matchNo: { in: [...DAILY_KNOCKOUT_MATCH_NOS] } } },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      match: { select: { matchNo: true } },
    },
  });
  if (liveRows.length === 0) return rows;

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  const results = asResults(tournament.officialResults);
  const fixturesByNo = new Map(knockoutDailyFixtures(results).map((f) => [f.matchNo, f]));

  // matchNo -> live score by team code (orientation the predictions are stored in).
  const liveByNo = new Map<number, Record<string, number>>();
  for (const r of liveRows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore === null || r.awayScore === null) continue;
    liveByNo.set(r.match.matchNo, { [r.homeTeamCode]: r.homeScore, [r.awayTeamCode]: r.awayScore });
  }
  if (liveByNo.size === 0) return rows;

  return rows.map((r) => {
    const byMatch = picksByEntry.get(r.entryId);
    if (!byMatch) return r;
    let pts = 0;
    for (const [no, byTeam] of liveByNo) {
      const fixture = fixturesByNo.get(no);
      if (!fixture || !fixture.homeCode || !fixture.awayCode) continue;
      const pred = byMatch.get(no);
      if (!pred || !(fixture.homeCode in pred) || !(fixture.awayCode in pred)) continue;
      const raw = scoreDailyKnockout({
        predByTeam: pred,
        homeCode: fixture.homeCode,
        awayCode: fixture.awayCode,
        actual: { home: byTeam[fixture.homeCode] ?? 0, away: byTeam[fixture.awayCode] ?? 0 },
        winnerCode: results.knockout?.[no] ?? null,
      }).points;
      pts += raw * roundWeight(no);
    }
    return pts > 0 ? { ...r, projected: pts } : r;
  });
}

// The public knockout Match Day Pick'em board: every standalone/pooled
// MATCH_DAY_3_PICKEM entry that has opted in AND holds at least one knockout pick,
// ranked on the round-weighted KNOCKOUT LADDER (group points excluded, later rounds
// weighted up, plus Perfect-Day bonuses). Cached per-pick points are refreshed on
// each FINAL knockout result via recompute; a display-only live projection folds in
// any in-progress knockout match.
export async function getDailyKnockoutLeaderboard(
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<LeaderboardRow[]> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);
  const [eligible, finalNos] = await Promise.all([
    loadKnockoutBoardEntries(tournamentId),
    loadFinalKnockoutMatchNos(tournamentId),
  ]);
  if (eligible.length === 0) return [];
  const perfectDays: PerfectEligibleDay[] = perfectEligibleDays(finalNos);

  const rows: LeaderboardRow[] = eligible.map((e) => ({
    rank: 0,
    entryId: e.id,
    label: e.label,
    userId: e.userId,
    // Rank on the round-weighted ladder total (+ Perfect-Day bonuses) — never the
    // cached totalPoints, which folds in the retired group score.
    total: knockoutLadderTotal(e.perPick, perfectDays),
    breakdown: null,
    tiebreak: null,
  }));

  const withLive = await overlayDailyKnockoutLiveProjection(
    tournamentId,
    rows,
    new Map(eligible.map((e) => [e.id, decodeDailyKnockoutByTeam(e.picks)])),
  );

  return rankEnteredRows(withLive, new Set(rows.map((r) => r.entryId)));
}

export interface KnockoutChampion {
  entryId: string;
  label: string;
  points: number; // weighted ladder points that won the round/day
}
export interface DayChampion extends KnockoutChampion {
  day: string; // yyyy-mm-dd
  stage: Stage;
}
export interface KnockoutChampions {
  byRound: Partial<Record<Stage, KnockoutChampion>>; // the top entry per round (once scored)
  byDay: DayChampion[]; // the top entry per completed ≥2-match day
}

// Cross-entry Round-Champion and Day-Winner crowns, derived from the same board
// field as the leaderboard. A round/day is only crowned once it has scored points;
// ties leave the round/day uncrowned (co-leaders — deliberately no arbitrary pick).
export async function getDailyKnockoutChampions(
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<KnockoutChampions> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);
  const [eligible, finalNos] = await Promise.all([
    loadKnockoutBoardEntries(tournamentId),
    loadFinalKnockoutMatchNos(tournamentId),
  ]);

  const byRound: Partial<Record<Stage, KnockoutChampion>> = {};
  for (const stage of STAGE_ORDER) {
    if (stage === "GROUP") continue;
    const ranked = eligible
      .map((e) => ({ e, points: ladderPointsByRound(e.perPick)[stage] }))
      .filter((x) => x.points > 0)
      .sort((a, b) => b.points - a.points);
    const top = uniqueLeader(ranked);
    if (top) byRound[stage] = { entryId: top.e.id, label: top.e.label, points: top.points };
  }

  const byDay: DayChampion[] = [];
  for (const day of perfectEligibleDays(finalNos)) {
    const ranked = eligible
      .map((e) => ({ e, points: ladderPointsByDay(e.perPick)[day.day] ?? 0 }))
      .filter((x) => x.points > 0)
      .sort((a, b) => b.points - a.points);
    const top = uniqueLeader(ranked);
    if (top) {
      byDay.push({ entryId: top.e.id, label: top.e.label, points: top.points, day: day.day, stage: day.stage });
    }
  }
  return { byRound, byDay };
}

// The sole leader of a descending-sorted list, or null on a tie for first (no crown
// on a dead heat).
function uniqueLeader<T extends { points: number }>(ranked: T[]): T | null {
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[1].points === ranked[0].points) return null;
  return ranked[0];
}
