// Pure scheduling policy for the h2h odds poller: decides whether a given poll
// should actually spend an Odds API credit. DB-free so it's unit-tested; pollOdds()
// runs the queries and applies this.
//
// Why snapshots and not an interval: one h2h call returns the whole tournament
// slate (1 credit), and The Odds API free tier is only 500 credits/mo. Interval
// polling ("every 10 min while live") has no monthly ceiling — a long match day
// alone can burn the quota. Instead we take a fixed, countable number of snapshots
// per match: one just before kickoff (the closing line) and one around halftime
// (after the first-half swing). That bounds h2h spend to ~2 credits per distinct
// kickoff time — and because the slate fetch refreshes every match's row at once,
// simultaneous kickoffs collapse into a single call, and upcoming matches stay
// covered for free.

export const PRE_WINDOW_START_MS = -30 * 60_000; // open the pre-match snapshot 30 min before kickoff…
export const PRE_WINDOW_END_MS = 0; // …closing at kickoff
export const HALF_WINDOW_START_MS = 45 * 60_000; // halftime snapshot from 45 min after kickoff…
export const HALF_WINDOW_END_MS = 75 * 60_000; // …through 75 min (covers the break + first-half stoppage)

export type OddsSnapshot = "pre" | "half";

// Which snapshot, if any, is due for one match right now. A snapshot fires once
// per window: when `now` is inside the window AND the match's stored odds predate
// that window's start (null = never fetched, so it fires). Returns null when no
// snapshot is due — including the whole gap between the two windows and after FT.
// `pre` is checked first so a match can never be "half-due" before it's "pre-due".
export function snapshotDue(
  now: number,
  kickoffMs: number,
  oddsFetchedAtMs: number | null,
): OddsSnapshot | null {
  const preStart = kickoffMs + PRE_WINDOW_START_MS;
  if (now >= preStart && now < kickoffMs + PRE_WINDOW_END_MS) {
    if (oddsFetchedAtMs == null || oddsFetchedAtMs < preStart) return "pre";
  }
  const halfStart = kickoffMs + HALF_WINDOW_START_MS;
  if (now >= halfStart && now < kickoffMs + HALF_WINDOW_END_MS) {
    if (oddsFetchedAtMs == null || oddsFetchedAtMs < halfStart) return "half";
  }
  return null;
}

// The kickoff range a match must fall in for *any* snapshot window to be open
// right now — used to pre-filter the DB query so snapshotDue only runs on
// plausible candidates. A window is open iff KO ∈ [now − 75 min, now + 30 min].
export function snapshotKickoffRange(now: number): { gt: Date; lt: Date } {
  return {
    gt: new Date(now - HALF_WINDOW_END_MS),
    lt: new Date(now - PRE_WINDOW_START_MS),
  };
}
