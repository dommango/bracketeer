// Pure scheduling policy for the h2h odds poller: decides whether a given poll
// should actually spend an Odds API credit, from the match schedule and how fresh
// the stored odds already are. DB-free so it's unit-tested; pollOdds() runs the
// queries and applies this.
//
// Why it exists: one h2h call returns the whole slate (1 credit), so the only
// lever on credit spend is *how often* we call. The Odds API free tier is 500
// credits/mo, so a blind every-5-min poll (~8,640/mo) blows the quota and the key
// dies. This gates spend to when odds actually move: frequent while a match is
// live, slow in the pre-match window, and nothing at all when no match is near.

export const LIVE_WINDOW_BEFORE_MS = 5 * 60_000; // a match counts as live from 5 min before kickoff…
export const LIVE_WINDOW_AFTER_MS = 155 * 60_000; // …through 155 min after (regulation + ET + shootout buffer)
export const PREMATCH_LOOKAHEAD_MS = 6 * 60 * 60_000; // "imminent" = a match kicks off within the next 6h
export const LIVE_MAX_AGE_MS = 10 * 60_000; // live: refresh at most every 10 min (frequent in-play movement)
export const PREMATCH_MAX_AGE_MS = 3 * 60 * 60_000; // pre-match: the upcoming slate's line, refreshed every ~3h

export type OddsTier = "live" | "prematch" | "idle";

// The polling tier for the current moment. `live` wins over `prematch` so an
// in-progress match always gets the fast cadence even if another kicks off soon.
export function oddsTier(liveNow: boolean, imminent: boolean): OddsTier {
  if (liveNow) return "live";
  if (imminent) return "prematch";
  return "idle";
}

// Max acceptable age of the stored odds for a tier, or null when the tier should
// never spend a credit (idle).
export function maxAgeForTier(tier: OddsTier): number | null {
  if (tier === "live") return LIVE_MAX_AGE_MS;
  if (tier === "prematch") return PREMATCH_MAX_AGE_MS;
  return null;
}

// Whether a fresh fetch is due: never when idle (maxAge null), always when no odds
// have been stored yet (bootstrap), otherwise only once the freshest row is older
// than the tier's max age.
export function oddsFetchDue(
  freshestFetchedAt: Date | null,
  maxAgeMs: number | null,
  now: number,
): boolean {
  if (maxAgeMs == null) return false;
  if (!freshestFetchedAt) return true;
  return now - freshestFetchedAt.getTime() >= maxAgeMs;
}
