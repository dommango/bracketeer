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

// Asian-handicap (spreads) line for a single fixture, from the home side's view:
// homeLine is the goals handicap applied to home_team (negative = home favored).
export interface SpreadsEvent {
  homeName: string;
  awayName: string;
  commenceTime: string; // ISO
  homeLine: number; // e.g. -0.5 (home gives half a goal)
  decimalHome: number;
  decimalAway: number;
}

// One team's tournament-winner (outright) price.
export interface OutrightEntry {
  teamName: string;
  decimal: number;
}

// One player's top-goalscorer (outright) price.
export interface GoalscorerEntry {
  playerName: string;
  decimal: number;
}

interface ApiOutcome { name: string; price: number; point?: number; description?: string }
interface ApiMarket { key: string; outcomes: ApiOutcome[] }
interface ApiBookmaker { markets: ApiMarket[] }
export interface ApiEvent {
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: ApiBookmaker[];
}

// Median of a non-empty list — the consensus price across bookmakers, robust to a
// single book posting a stale/outlier line in a way a mean is not.
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// Append a value to the list keyed by `k` in `map` (small accumulator helper).
function push<K>(map: Map<K, number[]>, k: K, v: number): void {
  const arr = map.get(k);
  if (arr) arr.push(v);
  else map.set(k, [v]);
}

// Consensus h2h prices: median each of home/draw/away across every bookmaker that
// quotes the match (not just bookmakers[0]). Outcomes map by name ("Draw" is
// literal; the other two match home_team/away_team).
export function parseOddsEvents(raw: ApiEvent[]): OddsEvent[] {
  const out: OddsEvent[] = [];
  for (const ev of raw) {
    const hs: number[] = [], ds: number[] = [], as: number[] = [];
    for (const bk of ev.bookmakers ?? []) {
      const h2h = bk.markets?.find((m) => m.key === "h2h");
      if (!h2h) continue;
      const priceOf = (name: string) => h2h.outcomes.find((o) => o.name === name)?.price;
      const dh = priceOf(ev.home_team);
      const da = priceOf(ev.away_team);
      const dd = priceOf("Draw");
      if (dh == null || da == null || dd == null) continue;
      hs.push(dh); ds.push(dd); as.push(da);
    }
    if (hs.length === 0) continue;
    out.push({
      homeName: ev.home_team,
      awayName: ev.away_team,
      commenceTime: ev.commence_time,
      decimalHome: median(hs),
      decimalDraw: median(ds),
      decimalAway: median(as),
    });
  }
  return out;
}

// Consensus totals: bookmakers may quote different goals lines, so group prices by
// line and use the line with the most quotes (ties → lower line), then median the
// Over/Under at that line. Reject asymmetric Over/Under (Over@2.5 vs Under@3.5).
export function parseTotalsEvents(raw: ApiEvent[]): TotalsEvent[] {
  const out: TotalsEvent[] = [];
  for (const ev of raw) {
    const overByLine = new Map<number, number[]>();
    const underByLine = new Map<number, number[]>();
    for (const bk of ev.bookmakers ?? []) {
      const totals = bk.markets?.find((m) => m.key === "totals");
      if (!totals) continue;
      const over = totals.outcomes.find((o) => o.name === "Over");
      const under = totals.outcomes.find((o) => o.name === "Under");
      if (over?.price == null || under?.price == null || over.point == null) continue;
      if (under.point != null && under.point !== over.point) continue;
      push(overByLine, over.point, over.price);
      push(underByLine, over.point, under.price);
    }
    // Pick the consensus line: most-quoted, lower line breaks ties.
    let best: number | null = null;
    let bestCount = 0;
    for (const [line, prices] of overByLine) {
      if (prices.length > bestCount || (prices.length === bestCount && (best == null || line < best))) {
        best = line;
        bestCount = prices.length;
      }
    }
    if (best == null) continue;
    out.push({
      homeName: ev.home_team,
      awayName: ev.away_team,
      commenceTime: ev.commence_time,
      totalLine: best,
      decimalOver: median(overByLine.get(best)!),
      decimalUnder: median(underByLine.get(best)!),
    });
  }
  return out;
}

// Consensus spreads: group prices by the home-side handicap line and use the
// most-quoted line (ties → lower line), then median the home/away prices at that
// line. A book is read only when its two points are mirror images (home -0.5 ⇄
// away +0.5) — a mismatch means an alternate/garbled line and is skipped.
export function parseSpreadsEvents(raw: ApiEvent[]): SpreadsEvent[] {
  const out: SpreadsEvent[] = [];
  for (const ev of raw) {
    const homeByLine = new Map<number, number[]>();
    const awayByLine = new Map<number, number[]>();
    for (const bk of ev.bookmakers ?? []) {
      const spreads = bk.markets?.find((m) => m.key === "spreads");
      if (!spreads) continue;
      const home = spreads.outcomes.find((o) => o.name === ev.home_team);
      const away = spreads.outcomes.find((o) => o.name === ev.away_team);
      if (home?.price == null || away?.price == null || home.point == null || away.point == null) continue;
      if (away.point !== -home.point) continue; // not mirror images → skip
      push(homeByLine, home.point, home.price);
      push(awayByLine, home.point, away.price);
    }
    let best: number | null = null;
    let bestCount = 0;
    for (const [line, prices] of homeByLine) {
      if (prices.length > bestCount || (prices.length === bestCount && (best == null || line < best))) {
        best = line;
        bestCount = prices.length;
      }
    }
    if (best == null) continue;
    out.push({
      homeName: ev.home_team,
      awayName: ev.away_team,
      commenceTime: ev.commence_time,
      homeLine: best,
      decimalHome: median(homeByLine.get(best)!),
      decimalAway: median(awayByLine.get(best)!),
    });
  }
  return out;
}

// Consensus tournament-winner prices: median each team's outright across every
// bookmaker on the first event (not just bookmakers[0]).
export function parseOutrights(raw: ApiEvent[]): OutrightEntry[] {
  const byName = aggregateOutrights(raw[0]);
  return [...byName].map(([teamName, prices]) => ({ teamName, decimal: median(prices) }));
}

// Consensus top-goalscorer prices: same per-outcome median as parseOutrights, but
// player names pass through (trimmed) since there's no code mapping.
export function parseGoalscorerOutrights(raw: ApiEvent[]): GoalscorerEntry[] {
  const byName = aggregateOutrights(raw[0]);
  return [...byName].map(([playerName, prices]) => ({ playerName: playerName.trim(), decimal: median(prices) }));
}

// Collect each named outcome's prices across all bookmakers' `outrights` markets
// on a single event. Shared by the winner + goalscorer parsers.
function aggregateOutrights(ev: ApiEvent | undefined): Map<string, number[]> {
  const byName = new Map<string, number[]>();
  if (!ev) return byName;
  for (const bk of ev.bookmakers ?? []) {
    const market = bk.markets?.find((m) => m.key === "outrights");
    if (!market) continue;
    for (const o of market.outcomes) {
      if (o.price == null || !o.name) continue;
      push(byName, o.name, o.price);
    }
  }
  return byName;
}
