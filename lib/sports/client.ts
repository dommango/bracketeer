// API-Football (v3) client. Only used when SPORTS_API_KEY is configured; the
// poller short-circuits otherwise. Manual entry remains the reliable core.

import { env } from "@/lib/env";

export interface FinishedFixture {
  externalId: string;
  scheduledAt: string | null; // ISO kickoff from API
  live: boolean;
  finished: boolean;
  homeExternalId: string;
  awayExternalId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePens: number | null;
  awayPens: number | null;
}

interface ApiFixture {
  fixture: { id: number; date?: string | null; status?: { short?: string } };
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
    externalId: String(f.fixture.id),
    scheduledAt: f.fixture.date ?? null,
    live: LIVE_STATUSES.has(f.fixture.status?.short ?? ""),
    finished: FINISHED_STATUSES.has(f.fixture.status?.short ?? ""),
    homeExternalId: String(f.teams.home.id),
    awayExternalId: String(f.teams.away.id),
    homeGoals: f.goals.home ?? null,
    awayGoals: f.goals.away ?? null,
    homePens: f.score?.penalty?.home ?? null,
    awayPens: f.score?.penalty?.away ?? null,
  }));
}
