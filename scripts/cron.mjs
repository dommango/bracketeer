// Railway worker entrypoint (always-on). Polls live scores every minute and runs
// the slower pollers on their own cadences from the same loop.
//
// Why a loop and not Railway cron: Railway's cron minimum interval is 5 minutes,
// which is the dominant source of match-update latency (a goal isn't seen until the
// next 5-min tick). An always-on worker can poll every 60s. poll-scores is cheap
// when idle — it returns with zero sports-API calls when no match is in the live
// window — so frequent polling only spends credits during live matches.
//
// Deploy as a normal (always-on) Railway service, NOT a cron service:
// railway.cron.json has no cronSchedule and restarts on failure.
const base = process.env.APP_BASE_URL;
const secret = process.env.CRON_SECRET;

if (!base || !secret) {
  console.error("APP_BASE_URL and CRON_SECRET are required.");
  process.exit(1);
}

const TICK_MS = 60_000; // live-score cadence
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function hit(path) {
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const body = await res.text();
    console.log(`${path} ${res.status}: ${body}`);
  } catch (err) {
    console.error(`${path} fetch failed:`, err);
  }
}

// Fire a named job at most once per `minutes`-wide wall-clock bucket. Drift-proof:
// a slow or slightly-late tick still runs each job exactly once per window, and the
// jobs stay phase-aligned to real time rather than to process start.
const lastBucket = {};
function due(name, minutes) {
  const bucket = Math.floor(Date.now() / (minutes * 60_000));
  if (lastBucket[name] === bucket) return false;
  lastBucket[name] = bucket;
  return true;
}

async function tick() {
  // Live scores every minute (the latency-critical poll).
  await hit("/api/cron/poll-scores");

  // h2h odds: called every minute, but the route self-throttles on the match
  // schedule (lib/odds/schedule.ts) — a credit is spent only when stored odds are
  // stale for the current tier (≤10 min live, ≤3 h pre-match, never when idle).
  // This is cheap when idle (a couple of indexed queries, no Odds API call), like
  // poll-scores, and keeps spend inside The Odds API's 500/mo free quota.
  await hit("/api/cron/poll-odds");

  // Futures (tournament winner, golden boot, totals) barely move — every 12h is
  // plenty and keeps these per-call-billed markets off the hot path.
  if (due("odds-extras", 720)) await hit("/api/cron/poll-odds-extras");
  if (due("lineups", 15)) await hit("/api/cron/poll-lineups");
  if (due("predictions", 60)) await hit("/api/cron/poll-predictions");
  if (due("injuries", 60)) await hit("/api/cron/poll-injuries");
  if (due("tickets", 30)) await hit("/api/cron/poll-tickets");
  if (due("topscorers", 60)) await hit("/api/cron/poll-topscorers");
}

// Always-on loop. Each tick is isolated so one failure never stops the poller, and
// the next tick is scheduled a fixed TICK_MS after the previous one finished.
for (;;) {
  const started = Date.now();
  try {
    await tick();
  } catch (err) {
    console.error("cron tick failed:", err);
  }
  await sleep(Math.max(0, TICK_MS - (Date.now() - started)));
}
