// Pure parsers for The Odds API per-event odds endpoint
// (`/sports/{sport}/events/{id}/odds`), which returns a single event carrying the
// requested *additional* markets — here BTTS (both teams to score) and anytime
// goalscorer. Env-free + network-free, so they're unit-tested directly; the fetch
// wrapper in client.ts binds them to env + the network. Mirrors parse.ts (which
// covers the featured whole-slate markets).

import type { ApiEvent } from "./parse";

// Both-teams-to-score consensus prices for one fixture.
export interface EventBtts {
  decimalYes: number;
  decimalNo: number;
}

// One player's anytime-goalscorer consensus price for one fixture.
export interface EventScorer {
  playerName: string;
  decimal: number;
}

// Median of a non-empty list — consensus price across bookmakers, robust to a
// single book's stale/outlier line in a way a mean is not. (Local copy; parse.ts
// keeps its own for the featured markets.)
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// Generic selection labels that are never a player name — a player-prop outcome
// uses these for the Yes/Over side while carrying the player in `description`.
const GENERIC = new Set(["yes", "no", "over", "under"]);

// Consensus BTTS: median the Yes and No prices across every book quoting the
// market. Returns null when no book offers btts for this event.
export function parseEventBtts(ev: ApiEvent | undefined): EventBtts | null {
  if (!ev) return null;
  const yes: number[] = [];
  const no: number[] = [];
  for (const bk of ev.bookmakers ?? []) {
    const btts = bk.markets?.find((m) => m.key === "btts");
    if (!btts) continue;
    const y = btts.outcomes.find((o) => o.name === "Yes")?.price;
    const n = btts.outcomes.find((o) => o.name === "No")?.price;
    if (y == null || n == null) continue;
    yes.push(y);
    no.push(n);
  }
  if (yes.length === 0) return null;
  return { decimalYes: median(yes), decimalNo: median(no) };
}

// Consensus anytime-goalscorer prices: median each player's price across every
// book quoting `player_goal_scorer_anytime`. The Odds API uses one of two outcome
// shapes — either the player is in `name` directly, or `name` is a generic
// selection ("Yes") and the player is in `description`. We read the player from
// `description` ONLY when `name` is generic, so a market-label description can never
// be mistaken for a player; otherwise the player is `name`.
export function parseEventScorers(ev: ApiEvent | undefined): EventScorer[] {
  if (!ev) return [];
  const byPlayer = new Map<string, number[]>();
  const order: string[] = [];
  for (const bk of ev.bookmakers ?? []) {
    const market = bk.markets?.find((m) => m.key === "player_goal_scorer_anytime");
    if (!market) continue;
    for (const o of market.outcomes) {
      if (o.price == null) continue;
      const sel = (o.name ?? "").trim();
      const player = GENERIC.has(sel.toLowerCase()) ? (o.description ?? "").trim() : sel;
      if (!player || GENERIC.has(player.toLowerCase())) continue;
      const arr = byPlayer.get(player);
      if (arr) arr.push(o.price);
      else {
        byPlayer.set(player, [o.price]);
        order.push(player);
      }
    }
  }
  return order.map((playerName) => ({ playerName, decimal: median(byPlayer.get(playerName)!) }));
}
