// API-Football (v3) client. Only used when SPORTS_API_KEY is configured; the
// poller short-circuits otherwise. Manual entry remains the reliable core.

import { env } from "@/lib/env";
import type { ApiPredictionResponse } from "@/lib/sports/predictions-parse";
import type { ApiLineupEntry } from "@/lib/sports/lineups-parse";
import type { ApiTopScorer } from "@/lib/sports/topscorers-parse";

export interface FinishedFixture {
  fixtureId: number; // numeric API id, used for events/stats sub-requests
  externalId: string;
  scheduledAt: string | null; // ISO kickoff from API
  live: boolean;
  finished: boolean;
  elapsed: number | null; // match minute; null when not yet started
  homeExternalId: string;
  awayExternalId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePens: number | null;
  awayPens: number | null;
}

interface ApiFixture {
  fixture: {
    id: number;
    date?: string | null;
    status?: { short?: string; elapsed?: number | null };
  };
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
  score?: { penalty?: { home: number | null; away: number | null } };
}

// Statuses API-Football reports for a decided match.
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
// Statuses for a match currently in progress.
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"]);

export async function fetchFixtures(signal?: AbortSignal): Promise<FinishedFixture[]> {
  const url = `${env.SPORTS_API_BASE}/fixtures?league=1&season=2026`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": env.SPORTS_API_KEY },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Sports API responded ${res.status}`);

  const json = (await res.json()) as { response?: ApiFixture[] };
  return (json.response ?? []).map((f) => ({
    fixtureId: f.fixture.id,
    externalId: String(f.fixture.id),
    scheduledAt: f.fixture.date ?? null,
    live: LIVE_STATUSES.has(f.fixture.status?.short ?? ""),
    finished: FINISHED_STATUSES.has(f.fixture.status?.short ?? ""),
    elapsed: f.fixture.status?.elapsed ?? null,
    homeExternalId: String(f.teams.home.id),
    awayExternalId: String(f.teams.away.id),
    homeGoals: f.goals.home ?? null,
    awayGoals: f.goals.away ?? null,
    homePens: f.score?.penalty?.home ?? null,
    awayPens: f.score?.penalty?.away ?? null,
  }));
}

// Raw shapes returned by the API; callers map to domain types.
export interface RawMatchEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number };
  player: { name: string | null };
  assist: { name: string | null };
  type: string; // "Goal", "Card", "subst", etc.
  detail: string; // "Normal Goal", "Own Goal", "Yellow Card", "Red Card", …
}

export interface RawTeamStats {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  yellowCards: number | null;
  redCards: number | null;
}

export interface RawMatchStats {
  home: RawTeamStats;
  away: RawTeamStats;
}

interface ApiEvent {
  time: { elapsed: number; extra?: number | null };
  team: { id: number };
  player: { name?: string | null };
  assist?: { name?: string | null };
  type: string;
  detail: string;
}

interface ApiStatEntry {
  type: string;
  value: number | string | null;
}

interface ApiTeamStats {
  team: { id: number };
  statistics: ApiStatEntry[];
}

function parseStatValue(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function findStat(stats: ApiStatEntry[], type: string): number | null {
  return parseStatValue(stats.find((s) => s.type === type)?.value ?? null);
}

function parseTeamStats(stats: ApiStatEntry[]): RawTeamStats {
  return {
    possession: findStat(stats, "Ball Possession"),
    shots: findStat(stats, "Total Shots"),
    shotsOnTarget: findStat(stats, "Shots on Goal"),
    corners: findStat(stats, "Corner Kicks"),
    fouls: findStat(stats, "Fouls"),
    yellowCards: findStat(stats, "Yellow Cards"),
    redCards: findStat(stats, "Red Cards"),
  };
}

// Pre-match predictions (win %, advice, form, h2h) for a single fixture. Returns
// null when the provider has no prediction row yet. Parsing lives in
// predictions-parse.ts (env-free, unit-tested).
export async function fetchPrediction(
  fixtureId: number,
  signal?: AbortSignal,
): Promise<ApiPredictionResponse | null> {
  const url = `${env.SPORTS_API_BASE}/predictions?fixture=${fixtureId}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": env.SPORTS_API_KEY },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Sports API /predictions responded ${res.status}`);
  const json = (await res.json()) as { response?: ApiPredictionResponse[] };
  return json.response?.[0] ?? null;
}

// Starting lineups for a fixture (publishes ~1h before kickoff). Empty array until
// then. Parsing/normalization lives in lineups-parse.ts (env-free, unit-tested).
export async function fetchLineups(
  fixtureId: number,
  signal?: AbortSignal,
): Promise<ApiLineupEntry[]> {
  const url = `${env.SPORTS_API_BASE}/fixtures/lineups?fixture=${fixtureId}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": env.SPORTS_API_KEY },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Sports API /lineups responded ${res.status}`);
  const json = (await res.json()) as { response?: ApiLineupEntry[] };
  return json.response ?? [];
}

// Tournament top scorers (Golden Boot race). One call returns the whole ranked
// board. Parsing/team-code mapping lives in topscorers-parse.ts (env-free, tested).
export async function fetchTopScorers(signal?: AbortSignal): Promise<ApiTopScorer[]> {
  const url = `${env.SPORTS_API_BASE}/players/topscorers?league=1&season=2026`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": env.SPORTS_API_KEY },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Sports API /topscorers responded ${res.status}`);
  const json = (await res.json()) as { response?: ApiTopScorer[] };
  return json.response ?? [];
}

export async function fetchMatchEvents(fixtureId: number): Promise<RawMatchEvent[]> {
  const url = `${env.SPORTS_API_BASE}/fixtures/events?fixture=${fixtureId}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": env.SPORTS_API_KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sports API /events responded ${res.status}`);

  const json = (await res.json()) as { response?: ApiEvent[] };
  return (json.response ?? []).map((e) => ({
    time: { elapsed: e.time.elapsed, extra: e.time.extra ?? null },
    team: { id: e.team.id },
    player: { name: e.player.name ?? null },
    assist: { name: e.assist?.name ?? null },
    type: e.type,
    detail: e.detail,
  }));
}

// homeTeamId / awayTeamId are the provider's numeric team ids (used to assign
// stats correctly regardless of response array order).
export async function fetchMatchStats(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
): Promise<RawMatchStats | null> {
  const url = `${env.SPORTS_API_BASE}/fixtures/statistics?fixture=${fixtureId}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": env.SPORTS_API_KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sports API /statistics responded ${res.status}`);

  const json = (await res.json()) as { response?: ApiTeamStats[] };
  const sides = json.response ?? [];
  if (sides.length < 2) return null;

  const homeSide = sides.find((s) => s.team.id === homeTeamId);
  const awaySide = sides.find((s) => s.team.id === awayTeamId);
  if (!homeSide || !awaySide) return null;

  return {
    home: parseTeamStats(homeSide.statistics),
    away: parseTeamStats(awaySide.statistics),
  };
}
