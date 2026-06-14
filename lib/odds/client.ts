// The Odds API (v4) client. soccer_fifa_world_cup, h2h market, one region =
// 1 credit/call (500/mo free). One call returns the whole upcoming slate.
// Only used when ODDS_API_KEY is set; the poller short-circuits otherwise.

import { env } from "@/lib/env";

export interface OddsEvent {
  homeName: string;
  awayName: string;
  commenceTime: string; // ISO
  decimalHome: number;
  decimalDraw: number;
  decimalAway: number;
}

interface ApiOutcome { name: string; price: number }
interface ApiMarket { key: string; outcomes: ApiOutcome[] }
interface ApiBookmaker { markets: ApiMarket[] }
interface ApiEvent {
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: ApiBookmaker[];
}

// Pull the first bookmaker's h2h prices; map the three outcomes to home/draw/away
// by name ("Draw" is literal; the other two match home_team/away_team).
export function parseOddsEvents(raw: ApiEvent[]): OddsEvent[] {
  const out: OddsEvent[] = [];
  for (const ev of raw) {
    const h2h = ev.bookmakers?.[0]?.markets?.find((m) => m.key === "h2h");
    if (!h2h) continue;
    const priceOf = (name: string) => h2h.outcomes.find((o) => o.name === name)?.price;
    const dh = priceOf(ev.home_team);
    const da = priceOf(ev.away_team);
    const dd = priceOf("Draw");
    if (dh == null || da == null || dd == null) continue;
    out.push({
      homeName: ev.home_team,
      awayName: ev.away_team,
      commenceTime: ev.commence_time,
      decimalHome: dh,
      decimalDraw: dd,
      decimalAway: da,
    });
  }
  return out;
}

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
