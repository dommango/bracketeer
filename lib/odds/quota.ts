// Tracks The Odds API's monthly credit usage from the response headers it returns
// on every call (`x-requests-remaining` / `x-requests-used`) and enforces a hard
// floor so the pollers stop spending before the free quota is exhausted — the guard
// we lacked when the group-stage crush silently drained the 500/mo allowance.
//
// State is a module-level singleton. The cron routes all run in the long-lived
// web-service process, so the latest reading persists across the per-minute polls
// (h2h, extras, props all import this same module). A process restart resets it to
// "unknown" (null), and the next Odds API response repopulates it — so the guard
// fails OPEN for at most one poll after a restart, never silently forever.

let lastRemaining: number | null = null;
let lastUsed: number | null = null;
let lastAt: number | null = null;

// Stop spending once fewer than this many credits remain. Headroom for (a) the
// reading being one call stale — the guard checks the value from the *previous*
// response — and (b) the last few in-flight polls to land without overshooting 0.
export const QUOTA_FLOOR = 40;

// Record the usage headers from an Odds API response. Called on every fetch (even
// non-2xx and the free /events listing — the headers are present regardless). Logs
// each reading so remaining credits are visible in the Railway service logs.
export function recordQuota(headers: Headers): void {
  const rem = headers.get("x-requests-remaining");
  const used = headers.get("x-requests-used");
  if (rem != null && rem !== "") lastRemaining = Number(rem);
  if (used != null && used !== "") lastUsed = Number(used);
  lastAt = Date.now();
  console.log(`[odds] quota: remaining=${lastRemaining ?? "?"} used=${lastUsed ?? "?"}`);
}

// True once the last known remaining credits dip below the floor. Unknown (null,
// pre-first-response) reports false so a fresh process still makes its first call.
export function quotaExhausted(): boolean {
  return lastRemaining != null && lastRemaining < QUOTA_FLOOR;
}

// Last known usage, for surfacing in poll summaries / diagnostics.
export function quotaSnapshot(): { remaining: number | null; used: number | null; at: number | null } {
  return { remaining: lastRemaining, used: lastUsed, at: lastAt };
}

// Test-only: reset the singleton so ordering-independent unit tests start clean.
export function __resetQuotaForTest(): void {
  lastRemaining = null;
  lastUsed = null;
  lastAt = null;
}
