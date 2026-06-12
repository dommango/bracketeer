// Read helpers for rendering pool pages.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getLeaderboard, asResults, asScoringConfig, type LeaderboardRow } from "@/lib/pool/scoring";
import { buildBracketView, type BracketView, type MatchScore } from "@/lib/pool/bracket-view";
import { resolveBracket } from "@/lib/pool/bracket";
import { computeMovers, type SnapshotPoint, type Mover } from "@/lib/pool/movers";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { buildMatchCenter, type MatchInput, type MatchStatus, type MatchCenterSection } from "@/lib/pool/match-center";
import { buildPickSplit, type PickSplit } from "@/lib/pool/pick-split";
import { buildProfile, tallyPickShare, type Profile } from "@/lib/pool/profile";
import { roundLabel, isScoredKnockout } from "@/lib/pool/rounds";
import { liveLeaders, projectedLivePoints } from "@/lib/pool/projected";
import { TEAMS } from "@/lib/scoring/data";
import type { Picks, Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";
import { listMessages } from "@/lib/pool/chat";
import {
  buildStanding,
  selectNextMatch,
  toHomeMover,
  type HomeView,
  type HomeMover,
  type HomeNextMatch,
} from "@/lib/pool/home";

// The WC2026 MVP runs a single tournament; admin routes default to it but accept
// an explicit slug so the same code serves future multi-tenant tournaments.
export const DEFAULT_TOURNAMENT_SLUG = "wc2026";

export async function getTournamentIdBySlug(
  slug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<string> {
  const t = await prisma.tournament.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  return t.id;
}

// Memoized per request so the pool layout and its child route page share one
// lookup instead of querying twice on every navigation.
export const getPoolByCode = cache(async (code: string) => {
  return prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { tournament: true },
  });
});

export interface PoolHeader {
  id: string;
  name: string;
  joinCode: string;
  tournamentName: string;
  tournamentStatus: string;
  entryCount: number;
}

// Lightweight header data for the shared pool layout — avoids recomputing the
// full leaderboard just to render the hero (the table route does that itself).
export async function getPoolHeader(code: string): Promise<PoolHeader | null> {
  const pool = await getPoolByCode(code);
  if (!pool) return null;
  const entryCount = await prisma.entry.count({ where: { poolId: pool.id } });
  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    tournamentName: pool.tournament.name,
    tournamentStatus: pool.tournament.status,
    entryCount,
  };
}

export interface PoolView {
  id: string;
  name: string;
  joinCode: string;
  tournamentName: string;
  tournamentStatus: string;
  leaderboard: LeaderboardRow[];
}

// Knockout pick rows carry the match id in their CSV-mirrored category ("M73").
const KNOCKOUT_PICK_SECTIONS = [
  "round_of_32",
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "final",
];

// Merge display-only projected live points into leaderboard rows. A no-op
// (rows returned untouched) unless a knockout match is currently live.
async function withProjectedPoints(
  poolId: string,
  tournamentId: string,
  scoringConfig: unknown,
  rows: LeaderboardRow[],
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
  const leaders = liveLeaders(
    liveRows.map((r) => ({ ...r, matchNo: r.match.matchNo })),
  );
  if (leaders.length === 0) return rows;

  const pickRows = await prisma.pick.findMany({
    where: { entry: { poolId }, section: { in: KNOCKOUT_PICK_SECTIONS } },
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

  const projected = projectedLivePoints(leaders, picksByEntry, asScoringConfig(scoringConfig));
  return rows.map((r) => {
    const pts = projected.get(r.entryId) ?? 0;
    return pts > 0 ? { ...r, projected: pts } : r;
  });
}

export async function getPoolView(code: string): Promise<PoolView | null> {
  const pool = await getPoolByCode(code);
  if (!pool) return null;
  const leaderboard = await withProjectedPoints(
    pool.id,
    pool.tournament.id,
    pool.tournament.scoringConfig,
    await getLeaderboard(pool.id),
  );
  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    tournamentName: pool.tournament.name,
    tournamentStatus: pool.tournament.status,
    leaderboard,
  };
}

// The live bracket + group standings for a pool's tournament, built from the
// official answer key and per-match display scores.
export async function getPoolBracket(poolId: string): Promise<BracketView | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournament: { select: { id: true, officialResults: true } } },
  });
  if (!pool) return null;

  const resultRows = await prisma.result.findMany({
    where: { match: { tournamentId: pool.tournament.id } },
    select: { homeScore: true, awayScore: true, status: true, match: { select: { matchNo: true } } },
  });
  const scores = new Map<number, MatchScore>(
    resultRows.map((r) => [
      r.match.matchNo,
      { homeScore: r.homeScore, awayScore: r.awayScore, status: r.status },
    ]),
  );

  return buildBracketView(asResults(pool.tournament.officialResults), scores);
}

// Movers over a window: for each entry, the delta between its standing at `since`
// (its latest snapshot at-or-before that time) and its current standing (its
// latest snapshot overall). Ranking is the pure computeMovers; this layer only
// reads the history and folds it into baseline/current maps.
export async function getMovers(poolId: string, since: Date): Promise<Mover[]> {
  const snaps = await prisma.scoreSnapshot.findMany({
    where: { poolId },
    orderBy: { capturedAt: "asc" },
    select: { entryId: true, totalPoints: true, rank: true, capturedAt: true },
  });

  const baseline = new Map<string, SnapshotPoint>();
  const current = new Map<string, SnapshotPoint>();
  for (const s of snaps) {
    const p: SnapshotPoint = { entryId: s.entryId, totalPoints: s.totalPoints, rank: s.rank };
    current.set(s.entryId, p); // ascending order → last write wins = latest standing
    if (s.capturedAt <= since) baseline.set(s.entryId, p); // latest at-or-before `since`
  }

  return computeMovers(baseline, [...current.values()]);
}

// Today's biggest gainer, or null if no one has moved since midnight. Returns
// null until there's a pre-today baseline so day-one imports don't masquerade as
// "movement today" (the whole leaderboard would read as gained-from-zero).
export async function getTodaysMover(poolId: string): Promise<HomeMover | null> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const priorCount = await prisma.scoreSnapshot.count({
    where: { poolId, capturedAt: { lt: startOfDay } },
  });
  if (priorCount === 0) return null;

  const movers = await getMovers(poolId, startOfDay);
  const top = movers.find((m) => m.pointsGained > 0);
  if (!top) return null;

  // Scope the lookup to this pool too — the id already comes from a pool-scoped
  // mover list, but constraining poolId keeps the read defensively tenant-safe.
  const entry = await prisma.entry.findFirst({
    where: { id: top.entryId, poolId },
    select: { label: true },
  });
  return toHomeMover(top, entry?.label ?? "—");
}

// The next match to surface on Home (see selectNextMatch for the choice rule).
export async function getNextMatch(poolId: string): Promise<HomeNextMatch | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return null;

  const matches = await prisma.match.findMany({
    where: { tournamentId: pool.tournamentId },
    select: {
      matchNo: true,
      roundCode: true,
      scheduledAt: true,
      scored: true,
      result: { select: { homeTeamCode: true, awayTeamCode: true } },
    },
  });

  const picked = selectNextMatch(
    matches.map((m) => ({
      matchNo: m.matchNo,
      roundCode: m.roundCode,
      scheduledAt: m.scheduledAt,
      scored: m.scored,
    })),
    new Date(),
  );
  if (!picked) return null;

  const full = matches.find((m) => m.matchNo === picked.matchNo);
  return {
    matchNo: picked.matchNo,
    roundCode: picked.roundCode,
    scheduledAt: picked.scheduledAt ? picked.scheduledAt.toISOString() : null,
    home: full?.result?.homeTeamCode ?? null,
    away: full?.result?.awayTeamCode ?? null,
  };
}

// The current user's per-match knockout winner picks in this pool (empty if the
// user is anonymous or has no entry here). Used to mark "your pick" on matches.
async function getEntryKnockoutPicks(
  poolId: string,
  userId: string | null,
): Promise<Record<number, string>> {
  if (!userId) return {};
  const entry = await prisma.entry.findFirst({
    where: { poolId, userId },
    select: { picks: true },
  });
  if (!entry) return {};
  const sub = pickRowsToSubmission(entry.picks);
  return sub.picks.knockout ?? {};
}

// The full Match-Center list for a pool: every match grouped by round, with
// teams resolved (group teams are literal codes on the slot ref; knockout teams
// come from the live Result row when present, else the resolved answer-key
// bracket), live/scheduled/final status, and the viewer's pick markers.
export async function getMatchCenter(
  poolId: string,
  userId: string | null,
): Promise<MatchCenterSection[]> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true, tournament: { select: { officialResults: true } } },
  });
  if (!pool) return [];

  const resolved = resolveBracket(asResults(pool.tournament.officialResults));

  const matches = await prisma.match.findMany({
    where: { tournamentId: pool.tournamentId },
    select: {
      matchNo: true,
      roundCode: true,
      scheduledAt: true,
      homeSlotRef: true,
      awaySlotRef: true,
      result: {
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          homeScore: true,
          awayScore: true,
          winnerCode: true,
          status: true,
        },
      },
    },
  });

  const yourPicks = await getEntryKnockoutPicks(poolId, userId);

  const inputs: MatchInput[] = matches.map((m) => {
    const isGroup = m.roundCode === "GROUP";
    const r = resolved[m.matchNo];
    // Group teams are fixed by the draw (the slot ref *is* the team code);
    // knockout teams come from the live Result, falling back to the answer key.
    const homeCode = isGroup ? m.homeSlotRef : (m.result?.homeTeamCode ?? r?.home ?? null);
    const awayCode = isGroup ? m.awaySlotRef : (m.result?.awayTeamCode ?? r?.away ?? null);
    return {
      matchNo: m.matchNo,
      roundCode: m.roundCode,
      scheduledAt: m.scheduledAt,
      homeCode,
      awayCode,
      homeScore: m.result?.homeScore ?? null,
      awayScore: m.result?.awayScore ?? null,
      winnerCode: m.result?.winnerCode ?? r?.winner ?? null,
      resultStatus: (m.result?.status as MatchStatus | undefined) ?? null,
    };
  });

  return buildMatchCenter(inputs, yourPicks);
}

export interface EntryPicks {
  entryId: string;
  label: string;
  picks: Picks;
}

// Every entry's decoded picks for a pool. Shared by the pick-split, the what-if
// projection feed, and the profile's contrarian-call math.
export async function getEntriesWithPicks(poolId: string): Promise<EntryPicks[]> {
  const entries = await prisma.entry.findMany({
    where: { poolId },
    select: { id: true, label: true, picks: true },
  });
  return entries.map((e) => ({
    entryId: e.id,
    label: e.label,
    picks: pickRowsToSubmission(e.picks).picks,
  }));
}

// The current answer key + scoring config for a pool's tournament. Feeds the
// members-only picks payload that the client-side what-if island projects from.
export async function getScoringContext(
  poolId: string,
): Promise<{ results: Results; scoringConfig: ScoringConfig } | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournament: { select: { officialResults: true, scoringConfig: true } } },
  });
  if (!pool) return null;
  return {
    results: asResults(pool.tournament.officialResults),
    scoringConfig: asScoringConfig(pool.tournament.scoringConfig),
  };
}

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "TBD";

export interface MatchDetailSide {
  code: string | null;
  name: string;
  score: number | null;
}

export interface MatchDetail {
  matchNo: number;
  roundCode: string;
  roundLabel: string;
  scheduledAt: string | null;
  status: MatchStatus;
  home: MatchDetailSide;
  away: MatchDetailSide;
  winnerCode: string | null;
  isKnockout: boolean;
  scored: boolean; // a scored knockout match (what-if + pick-split apply)
  pickSplit: PickSplit | null;
  yourPick: { code: string; name: string; correct: boolean | null } | null;
}

// One match's detail view: resolved teams, live status, the pool's pick-split
// (scored knockout matches only), and the viewer's own pick. Returns null when
// the match number doesn't exist in this pool's tournament.
export async function getMatchDetail(
  poolId: string,
  matchNo: number,
  userId: string | null,
): Promise<MatchDetail | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true, tournament: { select: { officialResults: true } } },
  });
  if (!pool) return null;

  const match = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId: pool.tournamentId, matchNo } },
    select: {
      matchNo: true,
      roundCode: true,
      scheduledAt: true,
      homeSlotRef: true,
      awaySlotRef: true,
      result: {
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          homeScore: true,
          awayScore: true,
          winnerCode: true,
          status: true,
        },
      },
    },
  });
  if (!match) return null;

  const resolved = resolveBracket(asResults(pool.tournament.officialResults));
  const r = resolved[matchNo];
  const isGroup = match.roundCode === "GROUP";
  const homeCode = isGroup ? match.homeSlotRef : (match.result?.homeTeamCode ?? r?.home ?? null);
  const awayCode = isGroup ? match.awaySlotRef : (match.result?.awayTeamCode ?? r?.away ?? null);
  const winnerCode = match.result?.winnerCode ?? r?.winner ?? null;
  const status: MatchStatus =
    (match.result?.status as MatchStatus | undefined) ?? (winnerCode ? "FINAL" : "SCHEDULED");
  const scored = isScoredKnockout(matchNo);

  // Pick-split + your-pick only carry meaning for scored knockout matches.
  let pickSplit: PickSplit | null = null;
  let yourPick: MatchDetail["yourPick"] = null;
  if (scored) {
    const entries = await getEntriesWithPicks(poolId);
    pickSplit = buildPickSplit(
      homeCode,
      awayCode,
      entries.map((e) => e.picks.knockout?.[matchNo]),
    );
    const mine = await getEntryKnockoutPicks(poolId, userId);
    const code = mine[matchNo];
    if (code) {
      yourPick = { code, name: teamName(code), correct: winnerCode ? code === winnerCode : null };
    }
  }

  return {
    matchNo,
    roundCode: match.roundCode,
    roundLabel: roundLabel(match.roundCode),
    scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
    status,
    home: { code: homeCode, name: teamName(homeCode), score: match.result?.homeScore ?? null },
    away: { code: awayCode, name: teamName(awayCode), score: match.result?.awayScore ?? null },
    winnerCode,
    isKnockout: !isGroup,
    scored,
    pickSplit,
    yourPick,
  };
}

// A single entry's player profile (hit-grid, accuracy, breakdown, boldest call).
// Returns null when the entry doesn't belong to this pool.
export async function getProfile(poolId: string, entryId: string): Promise<Profile | null> {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, poolId },
    select: { id: true, label: true, picks: true, breakdown: { select: { byCategory: true } } },
  });
  if (!entry) return null;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournament: { select: { officialResults: true } } },
  });
  if (!pool) return null;

  const [leaderboard, allEntries] = await Promise.all([
    getLeaderboard(poolId),
    getEntriesWithPicks(poolId),
  ]);
  const row = leaderboard.find((r) => r.entryId === entryId);

  return buildProfile({
    entryId: entry.id,
    label: entry.label,
    total: row?.total ?? 0,
    // Fall back to last place, but never report a rank beyond the field size.
    rank: row?.rank ?? Math.max(1, leaderboard.length),
    entryCount: leaderboard.length,
    picks: pickRowsToSubmission(entry.picks).picks,
    results: asResults(pool.tournament.officialResults),
    breakdown: (entry.breakdown?.byCategory as Record<string, number> | null) ?? null,
    pickShareByMatch: tallyPickShare(allEntries.map((e) => e.picks)),
  });
}

// Aggregate the Home dashboard. Chat teaser is members-only (isMember gates it),
// mirroring the chat route's access rule.
export async function getHomeView(
  poolId: string,
  userId: string | null,
  isMember: boolean,
): Promise<HomeView> {
  const [leaderboard, topMover, nextMatch, messages] = await Promise.all([
    getLeaderboard(poolId),
    getTodaysMover(poolId),
    getNextMatch(poolId),
    isMember ? listMessages(poolId, 1) : Promise.resolve([]),
  ]);

  const latest = messages.length > 0 ? messages[messages.length - 1] : null;
  const leader = leaderboard[0] ?? null;

  return {
    you: buildStanding(leaderboard, userId),
    leader: leader ? { label: leader.label, total: leader.total } : null,
    topMover,
    nextMatch,
    chatTeaser: latest
      ? { authorName: latest.authorName, body: latest.body, createdAt: latest.createdAt }
      : null,
  };
}
