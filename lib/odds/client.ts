// The Odds API (v4) network client. soccer_fifa_world_cup, h2h market, one region =
// 1 credit/call (500/mo free). One call returns the whole upcoming slate.
// Only used when ODDS_API_KEY is set; the pollers short-circuit otherwise. Pure
// response parsing lives in parse.ts (env-free, unit-tested).

import { env } from "@/lib/env";
import {
  parseOddsEvents,
  parseTotalsEvents,
  parseOutrights,
  parseGoalscorerOutrights,
  parseSpreadsEvents,
  type ApiEvent,
  type OddsEvent,
  type TotalsEvent,
  type SpreadsEvent,
  type OutrightEntry,
  type GoalscorerEntry,
} from "@/lib/odds/parse";
import {
  parseEventBtts,
  parseEventScorers,
  type EventBtts,
  type EventScorer,
} from "@/lib/odds/event-parse";

export type { OddsEvent, TotalsEvent, SpreadsEvent, OutrightEntry, GoalscorerEntry } from "@/lib/odds/parse";
export type { EventBtts, EventScorer } from "@/lib/odds/event-parse";

// One upcoming fixture from the free `/events` listing — used to resolve The Odds
// API's opaque event id for a fixture before requesting its per-event markets.
export interface EventListItem {
  id: string;
  homeName: string;
  awayName: string;
  commenceTime: string; // ISO
}

// The Odds API exposes tournament outrights as dedicated sport keys. This is the
// top-goalscorer market's key; verify it against the live catalogue at execution
// (`/sports`). If the market isn't offered on our plan the call 404s, fetchGoalscorer
// Outrights surfaces the error, and the poller's isolated try/catch leaves the
// section simply empty — no crash, no bad data.
const GOALSCORER_SPORT_KEY = "soccer_fifa_world_cup_top_goal_scorer";

export async function fetchOddsEvents(signal?: AbortSignal): Promise<OddsEvent[]> {
  const url =
    `${env.ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds` +
    `?apiKey=${env.ODDS_API_KEY}&regions=${env.ODDS_API_REGION}&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Odds API: unexpected response shape");
  return parseOddsEvents(json as ApiEvent[]);
}

// Totals (Over/Under) for the upcoming slate. Separate call from h2h so it can run
// on a slower cadence — totals lines move slowly and each market billed per call.
export async function fetchTotalsEvents(signal?: AbortSignal): Promise<TotalsEvent[]> {
  const url =
    `${env.ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds` +
    `?apiKey=${env.ODDS_API_KEY}&regions=${env.ODDS_API_REGION}&markets=totals&oddsFormat=decimal`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API (totals) responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Odds API: unexpected totals response shape");
  return parseTotalsEvents(json as ApiEvent[]);
}

// Asian-handicap (spreads) for the upcoming slate. Featured market, so one call
// returns the whole slate for 1 credit — same slow cadence as totals (handicap
// lines move slowly and each market is billed per call).
export async function fetchSpreadsEvents(signal?: AbortSignal): Promise<SpreadsEvent[]> {
  const url =
    `${env.ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds` +
    `?apiKey=${env.ODDS_API_KEY}&regions=${env.ODDS_API_REGION}&markets=spreads&oddsFormat=decimal`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API (spreads) responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Odds API: unexpected spreads response shape");
  return parseSpreadsEvents(json as ApiEvent[]);
}

// Tournament-winner futures. Uses the dedicated winner sport key, which returns a
// single event whose outcomes are every team's outright price.
export async function fetchOutrights(signal?: AbortSignal): Promise<OutrightEntry[]> {
  const url =
    `${env.ODDS_API_BASE}/sports/soccer_fifa_world_cup_winner/odds` +
    `?apiKey=${env.ODDS_API_KEY}&regions=${env.ODDS_API_REGION}&markets=outrights&oddsFormat=decimal`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API (outrights) responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Odds API: unexpected outrights response shape");
  return parseOutrights(json as ApiEvent[]);
}

// Top-goalscorer futures: every player's outright price on a single event. Uses
// the dedicated goalscorer sport key (see GOALSCORER_SPORT_KEY). One call covers
// the whole board.
export async function fetchGoalscorerOutrights(signal?: AbortSignal): Promise<GoalscorerEntry[]> {
  const url =
    `${env.ODDS_API_BASE}/sports/${GOALSCORER_SPORT_KEY}/odds` +
    `?apiKey=${env.ODDS_API_KEY}&regions=${env.ODDS_API_REGION}&markets=outrights&oddsFormat=decimal`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API (goalscorer) responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Odds API: unexpected goalscorer response shape");
  return parseGoalscorerOutrights(json as ApiEvent[]);
}

// Free `/events` listing (0 credits): every upcoming fixture with its opaque event
// id, so the per-event poller can resolve the id for a fixture before spending a
// credit on its props markets.
export async function fetchEventList(signal?: AbortSignal): Promise<EventListItem[]> {
  const url =
    `${env.ODDS_API_BASE}/sports/soccer_fifa_world_cup/events` +
    `?apiKey=${env.ODDS_API_KEY}`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API (events) responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Odds API: unexpected events response shape");
  return (json as Array<{ id: string; home_team: string; away_team: string; commence_time: string }>).map(
    (e) => ({ id: e.id, homeName: e.home_team, awayName: e.away_team, commenceTime: e.commence_time }),
  );
}

// Per-event additional markets for one fixture: BTTS + anytime goalscorer in a
// single call. Cost = markets × regions = 2 credits per event. Returns both parsed
// markets; either may be empty/null when a book doesn't offer it for this event.
export async function fetchEventMarkets(
  eventId: string,
  signal?: AbortSignal,
): Promise<{ btts: EventBtts | null; scorers: EventScorer[] }> {
  const url =
    `${env.ODDS_API_BASE}/sports/soccer_fifa_world_cup/events/${eventId}/odds` +
    `?apiKey=${env.ODDS_API_KEY}&regions=${env.ODDS_API_REGION}` +
    `&markets=btts,player_goal_scorer_anytime&oddsFormat=decimal`;
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`Odds API (event markets) responded ${res.status}`);
  const json = (await res.json()) as ApiEvent;
  return { btts: parseEventBtts(json), scorers: parseEventScorers(json) };
}
