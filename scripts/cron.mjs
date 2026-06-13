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
console.log(`cron ${res.status}: ${body}`);
process.exit(res.ok ? 0 : 1);
