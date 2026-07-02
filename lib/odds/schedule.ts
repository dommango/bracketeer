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

// An early line is captured once a match comes within ~18 h of kickoff. This seeds
// the bracket builders with odds well before the closing-line window opens (knockout
// picks lock at the R32 kickoff, so people fill them out the day before — the early
// snapshot means they see prices). It costs at most one extra credit per distinct
// kickoff: still ≤3 (early + pre + half) per match, comfortably inside 500/mo.
export const EARLY_WINDOW_START_MS = -18 * 60 * 60_000; // open the early snapshot 18 h before kickoff…
export const PRE_WINDOW_START_MS = -30 * 60_000; // open the pre-match (closing-line) snapshot 30 min before…
export const PRE_WINDOW_END_MS = 0; // …closing at kickoff
export const HALF_WINDOW_START_MS = 45 * 60_000; // halftime snapshot from 45 min after kickoff…
export const HALF_WINDOW_END_MS = 75 * 60_000; // …through 75 min (covers the break + first-half stoppage)

export type OddsSnapshot = "early" | "pre" | "half";

// Which snapshot, if any, is due for one match right now. A snapshot fires once
// per window: when `now` is inside the window AND the match's stored odds predate
// that window's start (null = never fetched, so it fires). Returns null when no
// snapshot is due — including the gaps between windows and after FT. Windows are
// checked earliest-first so a match can never skip ahead to a later snapshot.
export function snapshotDue(
  now: number,
  kickoffMs: number,
  oddsFetchedAtMs: number | null,
): OddsSnapshot | null {
  const earlyStart = kickoffMs + EARLY_WINDOW_START_MS;
  if (now >= earlyStart && now < kickoffMs + PRE_WINDOW_START_MS) {
    if (oddsFetchedAtMs == null || oddsFetchedAtMs < earlyStart) return "early";
  }
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
// plausible candidates. A window is open iff KO ∈ [now − 75 min, now + 18 h].
export function snapshotKickoffRange(now: number): { gt: Date; lt: Date } {
  return {
    gt: new Date(now - HALF_WINDOW_END_MS),
    lt: new Date(now - EARLY_WINDOW_START_MS),
  };
}

// Minimum spacing between extras polls (totals/spreads/outrights — 4+ credits per
// run). The cron's own 24 h bucket is in-memory and resets on every restart, and
// the cron service restarts with each deploy — so the DB timestamp of the last
// run, checked through this policy, is the ceiling that actually holds. 20 h (not
// 24) so one poll per calendar day still fires even as the cron's daily bucket
// boundary drifts around restarts.
export const EXTRAS_MIN_INTERVAL_MS = 20 * 60 * 60_000;

// Whether an extras poll may spend credits now, given when the last one ran
// (null = never). Pure for testing; pollOddsExtras supplies the DB timestamp.
export function extrasPollDue(lastFetchedAtMs: number | null, now: number): boolean {
  return lastFetchedAtMs == null || now - lastFetchedAtMs >= EXTRAS_MIN_INTERVAL_MS;
}
