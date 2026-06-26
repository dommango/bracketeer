// Read helpers for rendering pool pages.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getLeaderboard, asResults, asScoringConfig, type LeaderboardRow } from "@/lib/pool/scoring";
import { assignRanks } from "@/lib/pool/rank";
import { buildBracketView, type BracketView, type MatchScore } from "@/lib/pool/bracket-view";
import { resolveBracket } from "@/lib/pool/bracket";
import {
  knockoutR32Seed,
  knockoutOpenState,
  KNOCKOUT_PICKS_OPEN_UTC,
} from "@/lib/pool/knockout";
import { arePicksLocked } from "@/lib/pool/lock";
import type { ResolvedR32 } from "@/lib/scoring/resolve";
import { computeMovers, type SnapshotPoint, type Mover } from "@/lib/pool/movers";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import {
  buildMatchCenter,
  buildGroupCenterSections,
  type MatchInput,
  type MatchStatus,
  type MatchCenterSection,
  type MatchCenterRow,
} from "@/lib/pool/match-center";
import { buildPickSplit, type PickSplit } from "@/lib/pool/pick-split";
import {
  buildTimeline,
  buildStatBars,
  type TimelineItem,
  type StatBar,
  type TeamStatValues,
} from "@/lib/pool/match-live";
import { buildProfile, tallyPickShare, type Profile } from "@/lib/pool/profile";
import { buildPickAnalytics, type PickAnalytics } from "@/lib/pool/pick-analytics";
import { buildUpsetRadar, stakedTeamCodes, type UpsetMatchInput, type UpsetRow } from "@/lib/odds/upset";
import { matchPlayerCode } from "@/lib/odds/player-match";
import { roundLabel, isScoredKnockout } from "@/lib/pool/rounds";
import { liveLeaders, projectedLivePoints } from "@/lib/pool/projected";
import { computeGroupTables, provisionalStandings, type GroupResultRow } from "@/lib/pool/group-table";
import {
  projectStadiums,
  type RemainingMatch,
  type StadiumProjection,
} from "@/lib/pool/stadium-projection";
import { overlayProvisional, provisionalGroupDelta } from "@/lib/pool/group-provisional";
import { groupOverlayBreakdown, type GroupOverlayBreakdown } from "@/lib/pool/group-overlay";
import { TEAMS, GROUPS } from "@/lib/scoring/data";
import type { ImpliedProbs } from "@/lib/odds/map";
import type { H2HSummary } from "@/lib/sports/predictions-parse";
import type { LineupPlayer } from "@/lib/sports/lineups-parse";
import type { InjuryItem } from "@/lib/sports/injuries-parse";
import { venueFor } from "@/lib/scoring/schedule";
import { startOfDayInZone, matchdaysAhead } from "@/lib/tz";
import type { Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";
import {
  buildStandings,
  selectNextMatch,
  toHomeMover,
  type HomeView,
  type HomeMover,
  type HomeNextMatch,
  type HomeStats,
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

// Whether a tournament's group stage has kicked off. Reuses the pick-lock signal
// (`now >= startsAt`) so "creating a full-tournament game is too late" and
// "full-bracket picks are locked" can never disagree. Gates full-game creation.
export async function hasTournamentStarted(
  slug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<boolean> {
  const t = await prisma.tournament.findUniqueOrThrow({
    where: { slug },
    select: { startsAt: true },
  });
  return arePicksLocked(t.startsAt);
}

// Memoized per request so the pool layout and its child route page share one
// lookup instead of querying twice on every navigation.
export const getPoolByCode = cache(async (code: string) => {
  return prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { tournament: true },
  });
});

// Per-request memoized leaderboard read. The landing aggregates the leaderboard
// through both getPoolView and getHomeView, so this shares one compute instead
// of scanning + scoring the whole pool twice on the most-hit route.
const cachedLeaderboard = cache((poolId: string) => getLeaderboard(poolId));

// One DB match row with its Result, as selected by the match-center queries.
interface ResolvableMatch {
  matchNo: number;
  roundCode: string;
  scheduledAt: Date | null;
  homeSlotRef: string | null;
  awaySlotRef: string | null;
  venue: string | null;
  city: string | null;
  odds: ImpliedProbs | null;
  result: {
    homeTeamCode: string | null;
    awayTeamCode: string | null;
    homeScore: number | null;
    awayScore: number | null;
    winnerCode: string | null;
    status: string | null;
    elapsed: number | null;
    homePens: number | null;
    awayPens: number | null;
  } | null;
}

// Resolve one DB match row into a MatchInput. Group teams come from the live
// Result row (which preserves API home/away orientation) else the fixed draw
// slot ref; knockout teams come from the Result row else the resolved answer-key
// bracket. Shared by getMatchCenter and getLiveMatches so slot resolution lives
// in one place (it's load-bearing — see lib/scoring/resolve.ts).
function toMatchInput(m: ResolvableMatch, resolved: ReturnType<typeof resolveBracket>): MatchInput {
  const isGroup = m.roundCode === "GROUP";
  const r = resolved[m.matchNo];
  const homeCode = isGroup
    ? (m.result?.homeTeamCode ?? m.homeSlotRef)
    : (m.result?.homeTeamCode ?? r?.home ?? null);
  const awayCode = isGroup
    ? (m.result?.awayTeamCode ?? m.awaySlotRef)
    : (m.result?.awayTeamCode ?? r?.away ?? null);
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
    elapsed: m.result?.elapsed ?? null,
    homePens: m.result?.homePens ?? null,
    awayPens: m.result?.awayPens ?? null,
    homeRef: m.homeSlotRef,
    awayRef: m.awaySlotRef,
    venue: m.venue ?? null,
    city: m.city ?? null,
    cityToken: venueFor(m.matchNo)?.cityToken ?? null,
    odds: m.odds ?? null,
  };
}

// The shared match select for the match-center selectors — kept in one place so
// the field set can't drift across the pool and challenge read paths.
const MATCH_CENTER_SELECT = {
  matchNo: true,
  roundCode: true,
  scheduledAt: true,
  venue: true,
  city: true,
  homeSlotRef: true,
  awaySlotRef: true,
  odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
  result: {
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      winnerCode: true,
      status: true,
      elapsed: true,
      homePens: true,
      awayPens: true,
    },
  },
} as const;

// Resolved MatchInput[] for a tournament, optionally scoped to a set of match
// numbers, reusing the same slot resolution as the pool match center. Shared by
// getMatchCenter (whole tournament) and the public challenge boards (MD3 → the 24
// final group matches; Knockout → matches 73+), which have no pool to key on.
export async function getTournamentMatchInputs(
  tournamentId: string,
  matchNos?: readonly number[],
): Promise<MatchInput[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  if (!tournament) return [];

  const resolved = resolveBracket(asResults(tournament.officialResults));
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      ...(matchNos ? { matchNo: { in: [...matchNos] } } : {}),
    },
    select: MATCH_CENTER_SELECT,
  });
  return matches.map((m) => toMatchInput(m, resolved));
}

// Tournament status is derived, not stored: UPCOMING before kickoff, COMPLETE
// once the final (match 104) is decided, LIVE in between. (The old stored
// Tournament.status was never transitioned off UPCOMING, so the header badge
// read "Upcoming" all tournament — deriving it keeps the badge honest.)
async function deriveTournamentStatus(tournamentId: string, startsAt: Date): Promise<string> {
  if (new Date() < startsAt) return "UPCOMING";
  const final = await prisma.result.findFirst({
    where: { status: "FINAL", match: { tournamentId, matchNo: 104 } },
    select: { id: true },
  });
  return final ? "COMPLETE" : "LIVE";
}

export interface PoolHeader {
  id: string;
  name: string;
  joinCode: string;
  tournamentName: string;
  tournamentStatus: string;
  entryCount: number;
  format: string;
}

// Lightweight header data for the shared pool layout — avoids recomputing the
// full leaderboard just to render the hero (the table route does that itself).
export async function getPoolHeader(code: string): Promise<PoolHeader | null> {
  const pool = await getPoolByCode(code);
  if (!pool) return null;
  const [entryCount, tournamentStatus] = await Promise.all([
    prisma.entry.count({ where: { poolId: pool.id } }),
    deriveTournamentStatus(pool.tournament.id, pool.tournament.startsAt),
  ]);
  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    tournamentName: pool.tournament.name,
    tournamentStatus,
    entryCount,
    format: pool.format,
  };
}

export interface PoolView {
  id: string;
  name: string;
  joinCode: string;
  tournamentName: string;
  tournamentStatus: string;
  groupStageComplete: boolean;
  leaderboard: LeaderboardRow[];
}

// True once all 72 group matches are FINAL — gates medals + the knockouts default.
export const isGroupStageComplete = cache(async (tournamentId: string): Promise<boolean> => {
  const finalGroupMatches = await prisma.match.count({
    where: { tournamentId, roundCode: "GROUP", result: { status: "FINAL" } },
  });
  return finalGroupMatches >= 72;
});

export interface KnockoutState {
  // Picks can be made: any R32 matchup is concrete (provisional) or all 32 are set.
  open: boolean;
  // Open, but the field isn't final — some matchups are still TBD and a seeded slot
  // can still shift as group results land. Drives the "seeding isn't final" banner.
  provisional: boolean;
  // Fixed target for the "seeding finalises" countdown — when the last group
  // matches confirm the full bracket (just before the R32 kickoff). See knockout.ts.
  opensAt: Date;
  // When picks lock: the Round-of-32 kickoff (Match 73). Null if unscheduled.
  locksAt: Date | null;
  // The official R32 matchups the pick form seeds from (a/b per match 73–88).
  seed: ResolvedR32;
}

// Knockout-pool gating: whether picks are open (the 32 are set), when they lock
// (the R32 kickoff), and the official R32 seed the editor renders. Derived from
// the tournament answer key + the Match-73 schedule, so it tracks admin/API
// result entry without any extra state.
export const getKnockoutState = cache(async (tournamentId: string): Promise<KnockoutState> => {
  const [tournament, firstR32] = await Promise.all([
    prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      select: { officialResults: true },
    }),
    prisma.match.findUnique({
      where: { tournamentId_matchNo: { tournamentId, matchNo: 73 } },
      select: { scheduledAt: true },
    }),
  ]);
  const results = asResults(tournament.officialResults);
  const { open, provisional } = knockoutOpenState(results);
  return {
    open,
    provisional,
    opensAt: new Date(KNOCKOUT_PICKS_OPEN_UTC),
    locksAt: firstR32?.scheduledAt ?? null,
    seed: knockoutR32Seed(results),
  };
});

// Knockout pick rows carry the match id in their CSV-mirrored category ("M73").
const KNOCKOUT_PICK_SECTIONS = [
  "round_of_32",
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "final",
];

// Per-entry additive provisional group+thirds points from live/finished group
// matches. Display-only; mirrors withProjectedPoints' knockout projection but for
// the group stage. Empty map when no group match has a score yet.
async function provisionalGroupPoints(
  poolId: string,
  tournamentId: string,
  scoringConfig: unknown,
): Promise<Map<string, number>> {
  const groupResults = await prisma.result.findMany({
    where: {
      status: { in: ["LIVE", "FINAL"] },
      // Group matches are 1–72 (see lib/pool/rounds.ts); R32 starts at 73.
      match: { tournamentId, matchNo: { lte: 72 } },
    },
    select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true },
  });

  const rows: GroupResultRow[] = [];
  for (const r of groupResults) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore == null || r.awayScore == null) continue;
    rows.push({
      homeCode: r.homeTeamCode,
      awayCode: r.awayTeamCode,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
  }
  if (rows.length === 0) return new Map();

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  const official = asResults(tournament.officialResults);
  const overlay = overlayProvisional(official, provisionalStandings(computeGroupTables(rows)));
  const cfg = asScoringConfig(scoringConfig);

  const entries = await prisma.entry.findMany({
    where: { poolId },
    include: { picks: true },
  });

  const out = new Map<string, number>();
  for (const entry of entries) {
    const sub = pickRowsToSubmission(entry.picks);
    const delta = provisionalGroupDelta(sub.picks, official, overlay, cfg);
    if (delta > 0) out.set(entry.id, delta);
  }
  return out;
}

// Merge display-only projected live points into leaderboard rows. A no-op
// (rows returned untouched) unless a knockout match is currently live or a
// group match is live/finished with scorable provisional standings.
async function withProjectedPoints(
  poolId: string,
  tournamentId: string,
  scoringConfig: unknown,
  rows: LeaderboardRow[],
): Promise<LeaderboardRow[]> {
  const [liveRows, groupPoints] = await Promise.all([
    prisma.result.findMany({
      where: { status: "LIVE", match: { tournamentId } },
      select: {
        homeTeamCode: true,
        awayTeamCode: true,
        homeScore: true,
        awayScore: true,
        status: true,
        match: { select: { matchNo: true } },
      },
    }),
    provisionalGroupPoints(poolId, tournamentId, scoringConfig),
  ]);

  const leaders = liveLeaders(
    liveRows.map((r) => ({ ...r, matchNo: r.match.matchNo })),
  );
  if (leaders.length === 0 && groupPoints.size === 0) return rows;

  let projected = new Map<string, number>();
  if (leaders.length > 0) {
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
    projected = projectedLivePoints(leaders, picksByEntry, asScoringConfig(scoringConfig));
  }

  const withLive = rows.map((r) => {
    const pts = (projected.get(r.entryId) ?? 0) + (groupPoints.get(r.entryId) ?? 0);
    return pts > 0 ? { ...r, projected: pts } : r;
  });

  // Re-rank by live total (official + provisional/projected) so the standings
  // reflect who is actually ahead right now; the ▲ badge still shows the
  // provisional portion. Tied live totals share a place (competition ranking),
  // label breaks display order only.
  const liveTotal = (r: LeaderboardRow) => r.total + (r.projected ?? 0);
  const sorted = [...withLive].sort(
    (a, b) => liveTotal(b) - liveTotal(a) || a.label.localeCompare(b.label),
  );
  return assignRanks(sorted, liveTotal);
}

// The live leaderboard for a pool: the cached official board re-ranked by live
// (official + provisional) points. Shared by getPoolView and getHomeView via the
// per-request cache so both surfaces show the same order.
export const liveLeaderboard = cache(async (poolId: string): Promise<LeaderboardRow[]> => {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true, tournament: { select: { scoringConfig: true } } },
  });
  if (!pool) return [];
  return withProjectedPoints(
    poolId,
    pool.tournamentId,
    pool.tournament.scoringConfig,
    await cachedLeaderboard(poolId),
  );
});

export async function getPoolView(code: string): Promise<PoolView | null> {
  const pool = await getPoolByCode(code);
  if (!pool) return null;
  const [leaderboard, tournamentStatus, groupStageComplete] = await Promise.all([
    liveLeaderboard(pool.id),
    deriveTournamentStatus(pool.tournament.id, pool.tournament.startsAt),
    isGroupStageComplete(pool.tournament.id),
  ]);
  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    tournamentName: pool.tournament.name,
    tournamentStatus,
    groupStageComplete,
    leaderboard,
  };
}

// The live bracket + group standings for a tournament, built from the official
// answer key and per-match display scores. Pool-agnostic so the public challenge
// surfaces can render the same bracket/standings without a pool (getPoolBracket
// just resolves the tournament from a pool first).
export async function getTournamentBracket(tournamentId: string): Promise<BracketView | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  if (!tournament) return null;

  const resultRows = await prisma.result.findMany({
    where: { match: { tournamentId } },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      status: true,
      match: { select: { matchNo: true } },
    },
  });
  const scores = new Map<number, MatchScore>(
    resultRows.map((r) => [
      r.match.matchNo,
      { homeScore: r.homeScore, awayScore: r.awayScore, status: r.status },
    ]),
  );

  const groupRows: GroupResultRow[] = [];
  for (const r of resultRows) {
    if (r.match.matchNo > 72) continue;
    // Match the leaderboard's provisional-points filter exactly (LIVE/FINAL only)
    // so the displayed table and the ▲ live delta can never diverge.
    if (r.status !== "LIVE" && r.status !== "FINAL") continue;
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore == null || r.awayScore == null) continue;
    groupRows.push({
      homeCode: r.homeTeamCode,
      awayCode: r.awayTeamCode,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      matchNo: r.match.matchNo,
    });
  }

  return buildBracketView(asResults(tournament.officialResults), scores, groupRows);
}

// The live bracket + group standings for a pool's tournament.
export async function getPoolBracket(poolId: string): Promise<BracketView | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return null;
  return getTournamentBracket(pool.tournamentId);
}

export interface BracketOverlay {
  entryId: string;
  label: string;
  thirdAdvance: string[]; // the bracket's 3rd-place advancer picks (for the thirds table)
  breakdown: GroupOverlayBreakdown;
}

// Each of the viewer's brackets with its group picks attributed onto the live
// standings, for the home-page group overlay. Returns null when no overlay
// applies: signed out, a KNOCKOUT pool (no group picks), or the user owns no
// bracket here. Reuses the exact LIVE/FINAL group-row filter as getPoolBracket so
// the cards and the overlay can never diverge.
export async function getGroupOverlay(
  poolId: string,
  userId: string | null | undefined,
): Promise<BracketOverlay[] | null> {
  if (!userId) return null;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: {
      format: true,
      tournament: { select: { id: true, officialResults: true, scoringConfig: true } },
    },
  });
  if (!pool || pool.format === "KNOCKOUT") return null;

  const entries = await prisma.entry.findMany({
    where: { poolId, userId },
    orderBy: { createdAt: "asc" },
    include: { picks: true },
  });
  if (entries.length === 0) return null;

  const resultRows = await prisma.result.findMany({
    where: { status: { in: ["LIVE", "FINAL"] }, match: { tournamentId: pool.tournament.id, matchNo: { lte: 72 } } },
    select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true, status: true },
  });
  const groupRows: GroupResultRow[] = [];
  // Count FINAL group results per group: only when all 6 are FINAL is a team out of
  // the spots truly eliminated (a LIVE match can still swing the table).
  const teamGroup = new Map<string, string>();
  for (const [g, codes] of Object.entries(GROUPS)) for (const c of codes) teamGroup.set(c, g);
  const finalByGroup = new Map<string, number>();
  for (const r of resultRows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore == null || r.awayScore == null) continue;
    groupRows.push({
      homeCode: r.homeTeamCode,
      awayCode: r.awayTeamCode,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
    if (r.status === "FINAL") {
      const g = teamGroup.get(r.homeTeamCode);
      if (g) finalByGroup.set(g, (finalByGroup.get(g) ?? 0) + 1);
    }
  }
  const completedGroups = new Set(
    Object.keys(GROUPS).filter((g) => (finalByGroup.get(g) ?? 0) >= 6),
  );

  const official = asResults(pool.tournament.officialResults);
  const tables = computeGroupTables(groupRows);
  const overlay = overlayProvisional(official, provisionalStandings(tables));
  const cfg = asScoringConfig(pool.tournament.scoringConfig);

  return entries.map((e) => {
    const picks = pickRowsToSubmission(e.picks).picks;
    return {
      entryId: e.id,
      label: e.label,
      thirdAdvance: picks.thirdAdvance ?? [],
      breakdown: groupOverlayBreakdown(picks, official, overlay, cfg, tables, completedGroups),
    };
  });
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
  // "Today" rolls over at Eastern midnight (the pool's display zone), not the
  // server's UTC midnight — see lib/tz.
  const startOfDay = startOfDayInZone();

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

// The next match to surface on Home (see selectNextMatch for the choice rule),
// annotated with the viewer's winner pick when it's a scored knockout they picked.
export async function getNextMatch(
  poolId: string,
  userId: string | null = null,
): Promise<HomeNextMatch | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true, tournament: { select: { officialResults: true } } },
  });
  if (!pool) return null;

  const matches = await prisma.match.findMany({
    where: { tournamentId: pool.tournamentId },
    select: {
      matchNo: true,
      roundCode: true,
      scheduledAt: true,
      scored: true,
      homeSlotRef: true,
      awaySlotRef: true,
      result: { select: { homeTeamCode: true, awayTeamCode: true } },
      odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
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

  let yourPick: HomeNextMatch["yourPick"] = null;
  if (isScoredKnockout(picked.matchNo)) {
    const mine = await getEntryKnockoutPicks(poolId, userId);
    const code = mine[picked.matchNo];
    if (code) yourPick = { code, name: teamName(code) };
  }

  const full = matches.find((m) => m.matchNo === picked.matchNo);
  // Resolve teams like the match center does so the card shows flags pre-kickoff:
  // group teams come from the fixed draw slot ref (known before any result),
  // knockout teams from the resolved answer-key bracket.
  const resolved = resolveBracket(asResults(pool.tournament.officialResults));
  const isGroup = picked.roundCode === "GROUP";
  const home =
    full?.result?.homeTeamCode ?? (isGroup ? full?.homeSlotRef : resolved[picked.matchNo]?.home) ?? null;
  const away =
    full?.result?.awayTeamCode ?? (isGroup ? full?.awaySlotRef : resolved[picked.matchNo]?.away) ?? null;
  const v = venueFor(picked.matchNo);
  // How far ahead the next match sits, in Eastern matchdays — 0 when it's still
  // today's slate, 1+ once today is exhausted. Drives the card's "Tomorrow" tag so
  // a next-day game doesn't read as imminent. Unknown kickoff (pre-draw) → 0.
  const daysAhead = picked.scheduledAt ? Math.max(0, matchdaysAhead(picked.scheduledAt, new Date())) : 0;
  return {
    matchNo: picked.matchNo,
    roundCode: picked.roundCode,
    scheduledAt: picked.scheduledAt ? picked.scheduledAt.toISOString() : null,
    home,
    away,
    yourPick,
    venue: v?.venue ?? null,
    city: v?.city ?? null,
    cityToken: v?.cityToken ?? null,
    odds: full?.odds ?? null,
    daysAhead,
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
    select: { tournamentId: true },
  });
  if (!pool) return [];

  const [inputs, yourPicks] = await Promise.all([
    getTournamentMatchInputs(pool.tournamentId),
    getEntryKnockoutPicks(poolId, userId),
  ]);

  return buildMatchCenter(inputs, yourPicks);
}

// The most recently finalised match for the Home score-card row.
export async function getLastMatch(
  poolId: string,
  userId: string | null,
): Promise<MatchCenterRow | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true, tournament: { select: { officialResults: true } } },
  });
  if (!pool) return null;

  const result = await prisma.result.findFirst({
    where: { status: "FINAL", match: { tournamentId: pool.tournamentId } },
    orderBy: { updatedAt: "desc" },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      winnerCode: true,
      status: true,
      elapsed: true,
      homePens: true,
      awayPens: true,
      match: {
        select: {
          matchNo: true,
          roundCode: true,
          scheduledAt: true,
          venue: true,
          city: true,
          homeSlotRef: true,
          awaySlotRef: true,
          odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
        },
      },
    },
  });
  if (!result) return null;

  const resolved = resolveBracket(asResults(pool.tournament.officialResults));
  const yourPicks = await getEntryKnockoutPicks(poolId, userId);

  const m: ResolvableMatch = {
    matchNo: result.match.matchNo,
    roundCode: result.match.roundCode,
    scheduledAt: result.match.scheduledAt,
    venue: result.match.venue ?? null,
    city: result.match.city ?? null,
    homeSlotRef: result.match.homeSlotRef,
    awaySlotRef: result.match.awaySlotRef,
    odds: result.match.odds ?? null,
    result: {
      homeTeamCode: result.homeTeamCode,
      awayTeamCode: result.awayTeamCode,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      winnerCode: result.winnerCode,
      status: result.status,
      elapsed: result.elapsed,
      homePens: result.homePens,
      awayPens: result.awayPens,
    },
  };

  const sections = buildMatchCenter([toMatchInput(m, resolved)], yourPicks);
  return sections.flatMap((s) => s.matches)[0] ?? null;
}

// Matches in progress right now, as flat MatchCenter rows (round grouping isn't
// needed for the Home live card). LIVE only ever comes from a live Result feed,
// so we filter on the Result status and reuse the same resolution as the full
// match center. Empty when nothing is live.
export async function getLiveMatches(
  poolId: string,
  userId: string | null,
): Promise<MatchCenterRow[]> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true, tournament: { select: { officialResults: true } } },
  });
  if (!pool) return [];

  const matches = await prisma.match.findMany({
    where: { tournamentId: pool.tournamentId, result: { status: "LIVE" } },
    select: {
      matchNo: true,
      roundCode: true,
      scheduledAt: true,
      venue: true,
      city: true,
      homeSlotRef: true,
      awaySlotRef: true,
      odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
      result: {
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          homeScore: true,
          awayScore: true,
          winnerCode: true,
          status: true,
          elapsed: true,
          homePens: true,
          awayPens: true,
        },
      },
    },
  });
  if (matches.length === 0) return [];

  const resolved = resolveBracket(asResults(pool.tournament.officialResults));
  const yourPicks = await getEntryKnockoutPicks(poolId, userId);

  const inputs = matches.map((m) => toMatchInput(m, resolved));

  // buildMatchCenter groups + orders by round; flatten back to a single list.
  return buildMatchCenter(inputs, yourPicks).flatMap((s) => s.matches);
}

export type { EntryPicks } from "@/lib/pool/entry-picks";
import type { EntryPicks } from "@/lib/pool/entry-picks";

// Every entry's decoded picks for a pool. Shared by the pick-split, the what-if
// projection feed, and the profile's contrarian-call math. Per-request memoized
// so the Home dashboard (which reaches it via getProfile) doesn't re-decode the
// whole pool when other selectors on the same request already have.
export const getEntriesWithPicks = cache(async (poolId: string): Promise<EntryPicks[]> => {
  const entries = await prisma.entry.findMany({
    where: { poolId },
    select: { id: true, label: true, picks: true },
  });
  return entries.map((e) => ({
    entryId: e.id,
    label: e.label,
    picks: pickRowsToSubmission(e.picks).picks,
  }));
});

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

export async function getMatchEvents(matchId: string) {
  return prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: [{ minute: "asc" }, { extraMinute: "asc" }],
  });
}

export async function getMatchStats(matchId: string) {
  return prisma.matchStats.findUnique({ where: { matchId } });
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
  venue: string | null;
  city: string | null;
  cityToken: string | null;
  scheduledAt: string | null;
  status: MatchStatus;
  elapsed: number | null; // live match minute when LIVE, else null
  homePens: number | null; // shootout score when the tie went to penalties
  awayPens: number | null;
  home: MatchDetailSide;
  away: MatchDetailSide;
  winnerCode: string | null;
  isKnockout: boolean;
  scored: boolean; // a scored knockout match (what-if + pick-split apply)
  pickSplit: PickSplit | null;
  yourPick: { code: string; name: string; correct: boolean | null } | null;
  timeline: TimelineItem[]; // goal/card events (empty when none fed)
  stats: StatBar[]; // paired team stats (empty when none fed)
  odds: ImpliedProbs | null;
  oddsFetchedAt: Date | null; // when the match odds were last polled (freshness stamp)
  // Over/Under total-goals market; null until a totals line has been polled.
  totals: { line: number; overProb: number; underProb: number } | null;
  // Lowest price + official buy link (Ticketmaster); null when not configured.
  tickets: { minPrice: number | null; currency: string | null; url: string | null } | null;
  // Pre-match insights (model win %, advice, form, h2h); null until polled.
  prediction: {
    homePercent: number | null;
    drawPercent: number | null;
    awayPercent: number | null;
    advice: string | null;
    homeForm: string | null;
    awayForm: string | null;
    h2h: H2HSummary | null;
  } | null;
  // Starting XI + formation per team; null until the lineups poll has data.
  lineup: {
    homeFormation: string | null;
    awayFormation: string | null;
    home: LineupPlayer[];
    away: LineupPlayer[];
  } | null;
  // Injured / suspended players (flat, each carries its teamCode); empty until polled.
  injuries: InjuryItem[];
}

// Tournament-scoped match detail — the generic, pool-agnostic content for one
// match (resolved teams, live status, timeline, stats, odds, prediction, lineups,
// injuries, venue). Shared by the public challenges (which use it as-is) and the
// pool match page (getMatchDetail, which augments it with the pool's pick-split +
// the viewer's own pick). pickSplit/yourPick are always null here. Returns null
// when the match number doesn't exist in this tournament.
export async function getChallengeMatchDetail(
  tournamentId: string,
  matchNo: number,
): Promise<MatchDetail | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  if (!tournament) return null;

  const match = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId, matchNo } },
    select: {
      id: true,
      matchNo: true,
      roundCode: true,
      scheduledAt: true,
      venue: true,
      city: true,
      homeSlotRef: true,
      awaySlotRef: true,
      odds: {
        select: {
          homeWinProb: true,
          drawProb: true,
          awayWinProb: true,
          totalLine: true,
          overProb: true,
          underProb: true,
          fetchedAt: true,
        },
      },
      tickets: { select: { minPrice: true, currency: true, url: true } },
      prediction: {
        select: {
          homePercent: true,
          drawPercent: true,
          awayPercent: true,
          advice: true,
          homeForm: true,
          awayForm: true,
          h2h: true,
        },
      },
      lineup: {
        select: { homeFormation: true, awayFormation: true, home: true, away: true },
      },
      injuries: { select: { players: true } },
      result: {
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          homeScore: true,
          awayScore: true,
          winnerCode: true,
          status: true,
          elapsed: true,
          homePens: true,
          awayPens: true,
        },
      },
    },
  });
  if (!match) return null;

  const resolved = resolveBracket(asResults(tournament.officialResults));
  const r = resolved[matchNo];
  const isGroup = match.roundCode === "GROUP";
  const homeCode = isGroup
    ? (match.result?.homeTeamCode ?? match.homeSlotRef)
    : (match.result?.homeTeamCode ?? r?.home ?? null);
  const awayCode = isGroup
    ? (match.result?.awayTeamCode ?? match.awaySlotRef)
    : (match.result?.awayTeamCode ?? r?.away ?? null);
  const winnerCode = match.result?.winnerCode ?? r?.winner ?? null;
  const status: MatchStatus =
    (match.result?.status as MatchStatus | undefined) ?? (winnerCode ? "FINAL" : "SCHEDULED");
  const scored = isScoredKnockout(matchNo);

  // Live/finished match enrichment: the goal/card timeline + team stats the
  // poller already persists. Skip the queries entirely for not-yet-played matches.
  let timeline: TimelineItem[] = [];
  let stats: StatBar[] = [];
  if (status !== "SCHEDULED") {
    const [events, statsRow] = await Promise.all([
      getMatchEvents(match.id),
      getMatchStats(match.id),
    ]);
    timeline = buildTimeline(events, homeCode, awayCode);
    stats = buildStatBars(
      (statsRow?.home as unknown as TeamStatValues | undefined) ?? null,
      (statsRow?.away as unknown as TeamStatValues | undefined) ?? null,
    );
  }

  return {
    matchNo,
    roundCode: match.roundCode,
    roundLabel: roundLabel(match.roundCode),
    venue: match.venue ?? null,
    city: match.city ?? null,
    cityToken: venueFor(matchNo)?.cityToken ?? null,
    scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
    status,
    elapsed: status === "LIVE" ? (match.result?.elapsed ?? null) : null,
    homePens: match.result?.homePens ?? null,
    awayPens: match.result?.awayPens ?? null,
    home: { code: homeCode, name: teamName(homeCode), score: match.result?.homeScore ?? null },
    away: { code: awayCode, name: teamName(awayCode), score: match.result?.awayScore ?? null },
    winnerCode,
    isKnockout: !isGroup,
    scored,
    pickSplit: null,
    yourPick: null,
    timeline,
    stats,
    odds: match.odds ?? null,
    oddsFetchedAt: match.odds?.fetchedAt ?? null,
    totals:
      match.odds?.totalLine != null &&
      match.odds.overProb != null &&
      match.odds.underProb != null
        ? {
            line: match.odds.totalLine,
            overProb: match.odds.overProb,
            underProb: match.odds.underProb,
          }
        : null,
    tickets: match.tickets ?? null,
    prediction: match.prediction
      ? {
          homePercent: match.prediction.homePercent,
          drawPercent: match.prediction.drawPercent,
          awayPercent: match.prediction.awayPercent,
          advice: match.prediction.advice,
          homeForm: match.prediction.homeForm,
          awayForm: match.prediction.awayForm,
          h2h: (match.prediction.h2h as H2HSummary | null) ?? null,
        }
      : null,
    lineup: match.lineup
      ? {
          homeFormation: match.lineup.homeFormation,
          awayFormation: match.lineup.awayFormation,
          home: (match.lineup.home as unknown as LineupPlayer[]) ?? [],
          away: (match.lineup.away as unknown as LineupPlayer[]) ?? [],
        }
      : null,
    injuries: (match.injuries?.players as unknown as InjuryItem[] | undefined) ?? [],
  };
}

// One match's detail view for a POOL: the tournament-generic detail (above) plus
// the pool's pick-split (scored knockout matches only) and the viewer's own pick.
// Returns null when the match number doesn't exist in this pool's tournament.
export async function getMatchDetail(
  poolId: string,
  matchNo: number,
  userId: string | null,
): Promise<MatchDetail | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return null;

  const detail = await getChallengeMatchDetail(pool.tournamentId, matchNo);
  if (!detail || !detail.scored) return detail;

  // Pick-split + your-pick only carry meaning for scored knockout matches.
  const entries = await getEntriesWithPicks(poolId);
  const pickSplit = buildPickSplit(
    detail.home.code,
    detail.away.code,
    entries.map((e) => e.picks.knockout?.[matchNo]),
  );
  const mine = await getEntryKnockoutPicks(poolId, userId);
  const code = mine[matchNo];
  const yourPick = code
    ? { code, name: teamName(code), correct: detail.winnerCode ? code === detail.winnerCode : null }
    : null;

  return { ...detail, pickSplit, yourPick };
}

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
    select: { tournament: { select: { officialResults: true, startsAt: true } } },
  });
  if (!pool) return null;

  // liveLeaderboard (the official board re-ranked by live total), so the profile's
  // headline total + rank match the leaderboard and Home standing card exactly.
  // It's per-request cached, so on the Home route getHomeView already computed it.
  const [leaderboard, allEntries] = await Promise.all([
    liveLeaderboard(poolId),
    getEntriesWithPicks(poolId),
  ]);
  const row = leaderboard.find((r) => r.entryId === entryId);
  const projected = row?.projected ?? 0;

  return buildProfile({
    entryId: entry.id,
    label: entry.label,
    // Live total (official + provisional), to match every other surface.
    total: (row?.total ?? 0) + projected,
    projected: projected > 0 ? projected : undefined,
    // Fall back to last place, but never report a rank beyond the field size.
    rank: row?.rank ?? Math.max(1, leaderboard.length),
    entryCount: leaderboard.length,
    picks: pickRowsToSubmission(entry.picks).picks,
    results: asResults(pool.tournament.officialResults),
    breakdown: (entry.breakdown?.byCategory as Record<string, number> | null) ?? null,
    pickShareByMatch: tallyPickShare(allEntries.map((e) => e.picks)),
    locked: arePicksLocked(pool.tournament.startsAt),
  });
}

// Your headline stats for the dashboard, from your primary entry's profile.
// Null when you have no entry or nothing is decided yet (pre-tournament).
async function getHomeStats(poolId: string, entryId: string): Promise<HomeStats | null> {
  const profile = await getProfile(poolId, entryId);
  if (!profile || profile.accuracy.decided === 0) return null;
  return { accuracy: profile.accuracy, boldest: profile.boldest };
}

// Pool-wide pick consensus for the Home analytics card. Gated to reveal only once
// picks lock (kickoff), so brackets aren't exposed pre-lock; null when no entries.
export async function getPoolAnalytics(poolId: string): Promise<PickAnalytics | null> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournament: { select: { startsAt: true } } },
  });
  if (!pool || !arePicksLocked(pool.tournament.startsAt)) return null;

  const entries = await getEntriesWithPicks(poolId);
  if (entries.length === 0) return null;
  return buildPickAnalytics(entries.map((e) => e.picks));
}

// Aggregate the landing context: your standing(s), today's mover, the next match,
// any live matches, your headline stats, and the pool-wide pick consensus.
// Upcoming, not-yet-started matches that carry an odds row, as upset-radar inputs.
// Scoped to `odds: { isNot: null }` so the Home page pulls only the handful of
// priced fixtures (not all 104 matches). Team codes resolve the same way the
// Match-Center does (group teams from the slot ref, knockout from the answer-key
// bracket); `buildUpsetRadar`'s `hasUsableOdds` is the authoritative odds gate.
async function getUpsetMatches(poolId: string): Promise<UpsetMatchInput[]> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true, tournament: { select: { officialResults: true } } },
  });
  if (!pool) return [];

  const resolved = resolveBracket(asResults(pool.tournament.officialResults));
  const matches = await prisma.match.findMany({
    where: { tournamentId: pool.tournamentId, odds: { isNot: null } },
    select: {
      matchNo: true,
      roundCode: true,
      scheduledAt: true,
      homeSlotRef: true,
      awaySlotRef: true,
      odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
      result: { select: { homeTeamCode: true, awayTeamCode: true, winnerCode: true, status: true } },
    },
  });

  const inputs: UpsetMatchInput[] = [];
  for (const m of matches) {
    const isGroup = m.roundCode === "GROUP";
    const r = resolved[m.matchNo];
    const winnerCode = m.result?.winnerCode ?? r?.winner ?? null;
    // Mirror match-center's statusOf: SCHEDULED only when nothing's decided yet.
    const status = m.result?.status ?? (winnerCode ? "FINAL" : "SCHEDULED");
    if (status !== "SCHEDULED") continue;

    const homeCode = isGroup
      ? (m.result?.homeTeamCode ?? m.homeSlotRef)
      : (m.result?.homeTeamCode ?? r?.home ?? null);
    const awayCode = isGroup
      ? (m.result?.awayTeamCode ?? m.awaySlotRef)
      : (m.result?.awayTeamCode ?? r?.away ?? null);

    inputs.push({
      matchNo: m.matchNo,
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
      homeCode,
      awayCode,
      odds: m.odds,
    });
  }
  return inputs;
}

export async function getHomeView(poolId: string, userId: string | null): Promise<HomeView> {
  const [leaderboard, topMover, nextMatch, liveMatches, lastMatch, analytics, upsetMatches] =
    await Promise.all([
      liveLeaderboard(poolId),
      getTodaysMover(poolId),
      getNextMatch(poolId, userId),
      getLiveMatches(poolId, userId),
      getLastMatch(poolId, userId),
      getPoolAnalytics(poolId),
      getUpsetMatches(poolId),
    ]);

  const leader = leaderboard[0] ?? null;
  const standings = buildStandings(leaderboard, userId);
  const you = standings[0] ?? null;
  const stats = you ? await getHomeStats(poolId, you.entryId) : null;

  // Personalise the radar with the teams the viewer backed (across all their
  // brackets). Anonymous / unclaimed viewers get an untagged radar.
  const staked = new Set<string>();
  if (you) {
    const mine = new Set(standings.map((s) => s.entryId));
    for (const e of await getEntriesWithPicks(poolId)) {
      if (mine.has(e.entryId)) for (const code of stakedTeamCodes(e.picks)) staked.add(code);
    }
  }
  const upsets = buildUpsetRadar(upsetMatches, staked);

  return {
    you,
    otherEntries: standings.slice(1),
    leader: leader ? { label: leader.label, total: leader.total + (leader.projected ?? 0) } : null,
    topMover,
    nextMatch,
    liveMatches,
    lastMatch,
    stats,
    analytics,
    upsets,
  };
}

// The upset radar on its own — the same personalised computation the Home view
// does inline, exposed for the Matches → Odds view (which has no standings in
// scope). Staked teams come from the viewer's own brackets; anonymous viewers get
// an untagged radar.
export async function getUpsetRadar(poolId: string, userId: string | null): Promise<UpsetRow[]> {
  const upsetMatches = await getUpsetMatches(poolId);
  const staked = new Set<string>();
  if (userId) {
    const mine = new Set(buildStandings(await liveLeaderboard(poolId), userId).map((s) => s.entryId));
    for (const e of await getEntriesWithPicks(poolId)) {
      if (mine.has(e.entryId)) for (const code of stakedTeamCodes(e.picks)) staked.add(code);
    }
  }
  return buildUpsetRadar(upsetMatches, staked);
}

// Neutral-site prior for group matches with no live odds yet (no home advantage):
// a slightly draw-shy 0.375 / 0.25 / 0.375 split. Used so the projection can run
// from day one, sharpening as real odds land.
const NEUTRAL_GROUP_PRIOR = { homeWinProb: 0.375, drawProb: 0.25, awayWinProb: 0.375 };

function usableMatchProbs(o: {
  homeWinProb: number | null;
  drawProb: number | null;
  awayWinProb: number | null;
}): o is { homeWinProb: number; drawProb: number; awayWinProb: number } {
  if (o.homeWinProb == null || o.drawProb == null || o.awayWinProb == null) return false;
  if (o.homeWinProb < 0 || o.drawProb < 0 || o.awayWinProb < 0) return false;
  const sum = o.homeWinProb + o.drawProb + o.awayWinProb;
  return sum > 0.99 && sum < 1.01;
}

// Monte-Carlo projection of which teams are likely to fill each Round-of-32 slot
// (hence each stadium). FINAL group results are held fixed; every other group
// match is sampled from its live odds (or the neutral prior). Display-only.
export async function getStadiumProjections(poolId: string): Promise<StadiumProjection[]> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return [];

  const matches = await prisma.match.findMany({
    where: { tournamentId: pool.tournamentId, matchNo: { lte: 72 } },
    select: {
      matchNo: true,
      homeSlotRef: true,
      awaySlotRef: true,
      odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
      result: {
        select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true, status: true },
      },
    },
  });

  const finished: GroupResultRow[] = [];
  const remaining: RemainingMatch[] = [];

  for (const m of matches) {
    // For group matches the result's team codes equal the seeded slot refs, and
    // MatchOdds is stored oriented to that home code (see lib/odds/poll.ts), so
    // odds.homeWinProb lines up with homeCode below — keep these consistent.
    const homeCode = m.result?.homeTeamCode ?? m.homeSlotRef;
    const awayCode = m.result?.awayTeamCode ?? m.awaySlotRef;
    if (!homeCode || !awayCode) continue;

    const res = m.result;
    if (res && res.status === "FINAL" && res.homeScore != null && res.awayScore != null) {
      finished.push({ homeCode, awayCode, homeScore: res.homeScore, awayScore: res.awayScore });
    } else {
      const o = m.odds && usableMatchProbs(m.odds) ? m.odds : NEUTRAL_GROUP_PRIOR;
      remaining.push({
        homeCode,
        awayCode,
        homeWinProb: o.homeWinProb,
        drawProb: o.drawProb,
        awayWinProb: o.awayWinProb,
      });
    }
  }

  return projectStadiums({ finished, remaining });
}

// Group-Stage focused match center: 12 group sections (A–L) followed by knockout
// round sections. Used by the Matches tab.
export async function getGroupMatchCenter(
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
      venue: true,
      city: true,
      homeSlotRef: true,
      awaySlotRef: true,
      odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
      result: {
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          homeScore: true,
          awayScore: true,
          winnerCode: true,
          status: true,
          elapsed: true,
          homePens: true,
          awayPens: true,
        },
      },
    },
  });

  const yourPicks = await getEntryKnockoutPicks(poolId, userId);
  const inputs = matches.map((m) => toMatchInput(m, resolved));
  return buildGroupCenterSections(inputs, yourPicks);
}
