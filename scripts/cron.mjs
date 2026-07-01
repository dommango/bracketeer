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
  // schedule (lib/odds/schedule.ts) — a credit is spent only at a match's snapshot
  // moments (just before kickoff + around halftime), at most ~2 per distinct
  // kickoff. Cheap when idle (one indexed query, no Odds API call), like
  // poll-scores, and bounds spend inside The Odds API's 500/mo free quota.
  await hit("/api/cron/poll-odds");

  // Per-event props (BTTS + anytime goalscorer): same per-minute call + snapshot
  // self-throttle as poll-odds, but billed per event (2 credits/match/snapshot), so
  // it only fetches at a match's pre-kickoff + halftime moments. Cheap when idle
  // (one indexed query, zero Odds API calls until a snapshot is due).
  await hit("/api/cron/poll-odds-props");

  // Futures (tournament winner, golden boot, totals) barely move — once a day is
  // plenty and keeps these per-call-billed markets well inside the quota.
  if (due("odds-extras", 1440)) await hit("/api/cron/poll-odds-extras");
  if (due("team-stats", 1440)) await hit("/api/cron/poll-team-stats");
  if (due("players", 1440)) await hit("/api/cron/poll-players");
  if (due("squads", 1440)) await hit("/api/cron/poll-squads");
  if (due("lineups", 15)) await hit("/api/cron/poll-lineups");
  if (due("predictions", 60)) await hit("/api/cron/poll-predictions");
  if (due("injuries", 60)) await hit("/api/cron/poll-injuries");
  if (due("tickets", 30)) await hit("/api/cron/poll-tickets");
  if (due("topscorers", 60)) await hit("/api/cron/poll-topscorers");
  if (due("stat-leaders", 60)) await hit("/api/cron/poll-stat-leaders");

  // Prize resolution: record a sponsored award when a public challenge completes.
  // Idempotent and cheap when idle (a couple of indexed completion checks), so a
  // half-hour cadence comfortably catches the Final / last MD3 fixture finishing.
  if (due("resolve-prizes", 30)) await hit("/api/cron/resolve-prizes");
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
