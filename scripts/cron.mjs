// Railway cron entrypoint. Configure a separate Railway service that runs
// `node scripts/cron.mjs` on a schedule (`*/5 * * * *` — Railway's minimum cron
// interval is 5 minutes, so per-minute polling isn't possible on Railway cron).
// It pings the score poller on the web service with the shared secret.
const base = process.env.APP_BASE_URL;
const secret = process.env.CRON_SECRET;

if (!base || !secret) {
  console.error("APP_BASE_URL and CRON_SECRET are required.");
  process.exit(1);
}

const res = await fetch(`${base}/api/cron/poll-scores`, {
  method: "POST",
  headers: { "x-cron-secret": secret },
});

const body = await res.text();
console.log(`poll-scores ${res.status}: ${body}`);

// Odds poll is best-effort: a failure here does not affect the score poll exit code.
try {
  const oddsRes = await fetch(`${base}/api/cron/poll-odds`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  const oddsBody = await oddsRes.text();
  console.log(`poll-odds ${oddsRes.status}: ${oddsBody}`);
} catch (err) {
  console.error("poll-odds fetch failed:", err);
}

// Odds extras (Over/Under totals + tournament-winner outrights) refresh ~hourly:
// these markets move slowly and each is billed per API call, so they run on a far
// slower cadence than the every-5-min h2h poll. Best-effort; no effect on exit code.
if (new Date().getUTCMinutes() < 5) {
  try {
    const extrasRes = await fetch(`${base}/api/cron/poll-odds-extras`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const extrasBody = await extrasRes.text();
    console.log(`poll-odds-extras ${extrasRes.status}: ${extrasBody}`);
  } catch (err) {
    console.error("poll-odds-extras fetch failed:", err);
  }
}

// Tickets refresh ~every 30 min (prices move slowly + Ticketmaster has a daily
// quota), so only fire near the half-hour. Best-effort; never affects exit code.
if (new Date().getUTCMinutes() % 30 < 5) {
  try {
    const ticketsRes = await fetch(`${base}/api/cron/poll-tickets`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const ticketsBody = await ticketsRes.text();
    console.log(`poll-tickets ${ticketsRes.status}: ${ticketsBody}`);
  } catch (err) {
    console.error("poll-tickets fetch failed:", err);
  }
}

process.exit(res.ok ? 0 : 1);
