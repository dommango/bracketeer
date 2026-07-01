// Odds + scorer-board read queries, split out of lib/pool/queries.ts. Re-exported
// from there so callers keep importing from "@/lib/pool/queries".

import { prisma } from "@/lib/db";
import { matchPlayerCode } from "@/lib/odds/player-match";
import { teamName } from "./query-helpers";

// Per-knockout-match betting + insight signals for the bracket cards (pick sheet +
// read-only views): the win-probability split, the Over/Under goals line, and the
// model prediction (advice + each side's recent form). Every field is optional —
// each comes from a different poller and may be absent, so the card shows only what
// it has.
export interface KnockoutCardInfo {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  oddsFetchedAt: Date | null;
  totalLine: number | null;
  overProb: number | null;
  underProb: number | null;
  advice: string | null;
  homeForm: string | null;
  awayForm: string | null;
}

// Knockout-card signals keyed by match number, plus each team's championship-winner
// probability (`titleOdds`, keyed by 3-letter code) for the per-side title context.
// Covers every knockout match (73–104); only those with at least one polled signal
// appear in `info`, and a card renders the bar only once both teams are seated.
export async function getKnockoutMatchInfo(
  tournamentId: string,
): Promise<{ info: Record<number, KnockoutCardInfo>; titleOdds: Record<string, number> }> {
  const [matches, outrights] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId, matchNo: { gte: 73 } },
      select: {
        matchNo: true,
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
        prediction: { select: { advice: true, homeForm: true, awayForm: true } },
      },
    }),
    getChampionshipOdds(tournamentId, 48),
  ]);

  const info: Record<number, KnockoutCardInfo> = {};
  for (const m of matches) {
    if (!m.odds && !m.prediction) continue;
    info[m.matchNo] = {
      homeWinProb: m.odds?.homeWinProb ?? 0,
      drawProb: m.odds?.drawProb ?? 0,
      awayWinProb: m.odds?.awayWinProb ?? 0,
      oddsFetchedAt: m.odds?.fetchedAt ?? null,
      totalLine: m.odds?.totalLine ?? null,
      overProb: m.odds?.overProb ?? null,
      underProb: m.odds?.underProb ?? null,
      advice: m.prediction?.advice ?? null,
      homeForm: m.prediction?.homeForm ?? null,
      awayForm: m.prediction?.awayForm ?? null,
    };
  }

  const titleOdds: Record<string, number> = {};
  for (const o of outrights) titleOdds[o.teamCode] = o.winProb;

  return { info, titleOdds };
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

export interface TodayScorer {
  playerName: string;
  teamCode: string | null; // resolved from the scoring board when the name matches
  scoreProb: number; // implied P(scores) in their match, not normalized
  matchNo: number;
  fetchedAt: Date;
}

// "Most likely to score today": the anytime-goalscorer board flattened across the
// current slate, highest implied chance first. Per-event scorer odds are only polled
// at a match's snapshot moments (near kickoff), so fresh rows naturally belong to
// today's live/imminent fixtures — we bound to the last 12h of fetches and drop
// already-finished matches so the module always reflects what's about to be played.
// Empty when the props poll hasn't run (or the integration isn't configured).
export async function getTodayScorers(
  tournamentId: string,
  limit = 10,
): Promise<TodayScorer[]> {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const [rows, board] = await Promise.all([
    prisma.matchScorerOdds.findMany({
      where: {
        fetchedAt: { gte: cutoff },
        // isNot matches a null result (scheduled, no row yet) too, so imminent
        // fixtures stay in while finished ones drop out.
        match: { tournamentId, result: { isNot: { status: "FINAL" } } },
      },
      orderBy: { scoreProb: "desc" },
      take: limit,
      select: {
        playerName: true,
        scoreProb: true,
        fetchedAt: true,
        match: { select: { matchNo: true } },
      },
    }),
    prisma.topScorer.findMany({ where: { tournamentId }, select: { playerName: true, teamCode: true } }),
  ]);
  return rows.map((r) => ({
    playerName: r.playerName,
    teamCode: matchPlayerCode(r.playerName, board),
    scoreProb: r.scoreProb,
    matchNo: r.match.matchNo,
    fetchedAt: r.fetchedAt,
  }));
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

// Secondary stat leaderboards (assist + disciplinary boards), each lowest-rank
// first. Empty when the stat-leaders poll hasn't run (or the sports integration
// isn't configured). One query, split by category for the board UI.
export interface StatLeaderRow {
  rank: number;
  playerName: string;
  teamCode: string;
  teamName: string;
  value: number; // assists / yellow cards / red cards for the board it's on
  appearances: number | null;
  fetchedAt: Date;
}

export interface StatLeaders {
  assists: StatLeaderRow[];
  yellowCards: StatLeaderRow[];
  redCards: StatLeaderRow[];
}

export async function getStatLeaders(tournamentId: string, limit = 15): Promise<StatLeaders> {
  const rows = await prisma.statLeader.findMany({
    where: { tournamentId },
    orderBy: [{ category: "asc" }, { rank: "asc" }],
    select: {
      category: true,
      rank: true,
      playerName: true,
      teamCode: true,
      value: true,
      appearances: true,
      fetchedAt: true,
    },
  });
  const pick = (category: "ASSISTS" | "YELLOW_CARDS" | "RED_CARDS"): StatLeaderRow[] =>
    rows
      .filter((r) => r.category === category)
      .slice(0, limit)
      .map((r) => ({
        rank: r.rank,
        playerName: r.playerName,
        teamCode: r.teamCode,
        teamName: teamName(r.teamCode),
        value: r.value,
        appearances: r.appearances,
        fetchedAt: r.fetchedAt,
      }));
  return { assists: pick("ASSISTS"), yellowCards: pick("YELLOW_CARDS"), redCards: pick("RED_CARDS") };
}

// A team's tournament form / record (API-Football /teams/statistics). Null until
// the team-stats poll has run (or the sports integration isn't configured).
export interface TeamStatRow {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  failedToScore: number;
  form: string | null;
  fetchedAt: Date;
}

export async function getTeamStats(tournamentId: string, teamCode: string): Promise<TeamStatRow | null> {
  const row = await prisma.teamStat.findUnique({
    where: { tournamentId_teamCode: { tournamentId, teamCode } },
    select: {
      played: true,
      wins: true,
      draws: true,
      losses: true,
      goalsFor: true,
      goalsAgainst: true,
      cleanSheets: true,
      failedToScore: true,
      form: true,
      fetchedAt: true,
    },
  });
  return row;
}
