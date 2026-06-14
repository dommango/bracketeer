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

process.exit(res.ok ? 0 : 1);
