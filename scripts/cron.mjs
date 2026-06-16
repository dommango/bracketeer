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

// Match predictions (win %, advice, form, h2h) refresh ~hourly. Billed per fixture,
// so the poller itself only touches upcoming fixtures (capped); the cron fires on a
// staggered window (minute 10–14) so it doesn't pile onto the :00 odds-extras call.
// Best-effort; never affects exit code.
{
  const min = new Date().getUTCMinutes();
  if (min >= 10 && min < 15) {
    try {
      const predRes = await fetch(`${base}/api/cron/poll-predictions`, {
        method: "POST",
        headers: { "x-cron-secret": secret },
      });
      const predBody = await predRes.text();
      console.log(`poll-predictions ${predRes.status}: ${predBody}`);
    } catch (err) {
      console.error("poll-predictions fetch failed:", err);
    }
  }
}

// Lineups publish ~1h before kickoff and don't change, so poll a few times an hour
// near matches (the poller targets only near-KO fixtures and skips ones already
// stored). Fire at minute :05 to stay off the :00 and :10 windows. Best-effort.
if (new Date().getUTCMinutes() % 15 === 5) {
  try {
    const lineupsRes = await fetch(`${base}/api/cron/poll-lineups`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const lineupsBody = await lineupsRes.text();
    console.log(`poll-lineups ${lineupsRes.status}: ${lineupsBody}`);
  } catch (err) {
    console.error("poll-lineups fetch failed:", err);
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
