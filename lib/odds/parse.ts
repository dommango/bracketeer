// Pure parsers for The Odds API responses — no env/network, so they're unit-tested
// directly. The fetch wrappers in client.ts bind these to env + the network.

export interface OddsEvent {
  homeName: string;
  awayName: string;
  commenceTime: string; // ISO
  decimalHome: number;
  decimalDraw: number;
  decimalAway: number;
}

// Over/Under total-goals line for a single fixture.
export interface TotalsEvent {
  homeName: string;
  awayName: string;
  commenceTime: string; // ISO
  totalLine: number; // e.g. 2.5
  decimalOver: number;
  decimalUnder: number;
}

// One team's tournament-winner (outright) price.
export interface OutrightEntry {
  teamName: string;
  decimal: number;
}

interface ApiOutcome { name: string; price: number; point?: number }
interface ApiMarket { key: string; outcomes: ApiOutcome[] }
interface ApiBookmaker { markets: ApiMarket[] }
export interface ApiEvent {
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

// Pull the first bookmaker's totals market; the Over and Under outcomes share a
// single `point` (the goals line). Skip events without a usable totals line.
export function parseTotalsEvents(raw: ApiEvent[]): TotalsEvent[] {
  const out: TotalsEvent[] = [];
  for (const ev of raw) {
    const totals = ev.bookmakers?.[0]?.markets?.find((m) => m.key === "totals");
    if (!totals) continue;
    const over = totals.outcomes.find((o) => o.name === "Over");
    const under = totals.outcomes.find((o) => o.name === "Under");
    // Require both prices and a single shared line — reject asymmetric/alternate
    // totals so we never pair an Over@2.5 prob with an Under@3.5.
    if (over?.price == null || under?.price == null || over.point == null) continue;
    if (under.point != null && under.point !== over.point) continue;
    out.push({
      homeName: ev.home_team,
      awayName: ev.away_team,
      commenceTime: ev.commence_time,
      totalLine: over.point,
      decimalOver: over.price,
      decimalUnder: under.price,
    });
  }
  return out;
}

// The winner market lists every team as an outright outcome on a single event.
// Take the first event's `outrights` market.
export function parseOutrights(raw: ApiEvent[]): OutrightEntry[] {
  const market = raw[0]?.bookmakers?.[0]?.markets?.find((m) => m.key === "outrights");
  if (!market) return [];
  const out: OutrightEntry[] = [];
  for (const o of market.outcomes) {
    if (o.price == null || !o.name) continue;
    out.push({ teamName: o.name, decimal: o.price });
  }
  return out;
}
