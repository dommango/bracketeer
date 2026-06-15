import { z } from "zod";

// Server-only configuration, validated once at import. Throwing here surfaces
// misconfiguration loudly at startup rather than at the first request.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars"),
  // Auth.js infers its own URL from the request when trustHost is set; AUTH_URL
  // is only needed behind some proxies. Optional so local dev needs no value.
  AUTH_URL: z.string().default(""),
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  // Comma-separated emails allowed to enter official results (the tournament
  // admins). Empty in dev — see isAdminEmail below for the open-dev fallback.
  ADMIN_EMAILS: z.string().default(""),
  // Email magic-link (SMTP). When absent, magic-link sign-in is disabled and
  // links are logged to the server console for local development.
  EMAIL_SERVER: z.string().default(""),
  EMAIL_FROM: z.string().default("HessFest <no-reply@bracketeer.app>"),
  CRON_SECRET: z.string().min(1),
  // Sports data API (optional — manual result entry works without it).
  SPORTS_API_KEY: z.string().default(""),
  SPORTS_API_BASE: z.string().default("https://v3.football.api-sports.io"),
  // Betting odds (The Odds API — optional; win-prob UI disables cleanly without it).
  ODDS_API_KEY: z.string().default(""),
  ODDS_API_BASE: z.string().default("https://api.the-odds-api.com/v4"),
  ODDS_API_REGION: z.string().default("eu"),
  // Match tickets — Ticketmaster Discovery for the event list + official buy
  // link (optional; the ticket line hides cleanly without a key).
  TICKETMASTER_API_KEY: z.string().default(""),
  TICKETMASTER_API_BASE: z.string().default("https://app.ticketmaster.com/discovery/v2"),
  // Optional price overlay — SeatGeek's lowest_price, used only to fill a price
  // when Ticketmaster's priceRanges is empty (common for WC resale inventory).
  SEATGEEK_CLIENT_ID: z.string().default(""),
  SEATGEEK_API_BASE: z.string().default("https://api.seatgeek.com/2"),
  // Giphy (optional — the GIF picker in chat disables cleanly without it).
  GIPHY_API_KEY: z.string().default(""),
  // Notion mirror for in-app feedback (optional — submissions still persist to
  // the DB without it). Needs an integration token + the target database id.
  NOTION_API_KEY: z.string().default(""),
  NOTION_FEEDBACK_DB_ID: z.string().default(""),
  // Stripe billing (optional — premium upgrades disable cleanly without it).
  // All three are required to enable checkout + webhook handling.
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_PREMIUM: z.string().default(""),
  // Apple Push Notifications (APNs token-based auth — optional; native push
  // disables cleanly when unset). APNS_PRIVATE_KEY is the .p8 contents (PEM);
  // a literal "\n"-escaped value (common in dashboards) is normalized below.
  APNS_KEY_ID: z.string().default(""),
  APNS_TEAM_ID: z.string().default(""),
  APNS_BUNDLE_ID: z.string().default(""),
  APNS_PRIVATE_KEY: z.string().default("").transform((s) => s.replace(/\\n/g, "\n")),
  // Send via Apple's production gateway (api.push.apple.com) vs the sandbox
  // (api.development.push.apple.com). Default sandbox — safe for dev/TestFlight.
  APNS_PRODUCTION: z
    .string()
    .default("")
    .transform((s) => s === "1" || s.toLowerCase() === "true"),
});

export const env = schema.parse(process.env);

export const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
export const emailEnabled = Boolean(env.EMAIL_SERVER);
export const sportsApiEnabled = Boolean(env.SPORTS_API_KEY);
export const oddsApiEnabled = Boolean(env.ODDS_API_KEY);
export const giphyEnabled = Boolean(env.GIPHY_API_KEY);
// Tickets: Ticketmaster supplies the event list + buy link (the integration
// gate). SeatGeek is an optional price overlay layered on top when configured.
export const ticketsEnabled = Boolean(env.TICKETMASTER_API_KEY);
export const seatgeekEnabled = Boolean(env.SEATGEEK_CLIENT_ID);
// Feedback → Notion mirror needs both the token and the destination database id.
// Missing either keeps feedback DB-only (the sync is fire-and-forget regardless).
export const notionEnabled = Boolean(env.NOTION_API_KEY && env.NOTION_FEEDBACK_DB_ID);
// Stripe needs all three secrets to operate: the API key to create checkout
// sessions, the price id to subscribe to, and the webhook secret to trust
// incoming events. Missing any one disables billing (upgrade UI shows a notice).
export const stripeEnabled = Boolean(
  env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_PREMIUM,
);
// APNs needs all four: the key id + team id name the signing key, the bundle id
// is the push topic, and the .p8 private key signs the provider JWT. Missing any
// one disables push (registration still succeeds; nothing is ever sent).
export const pushEnabled = Boolean(
  env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_BUNDLE_ID && env.APNS_PRIVATE_KEY,
);

const adminEmails = new Set(
  env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

// Whether an email may enter official results. When ADMIN_EMAILS is unset, the
// admin tools are open ONLY in real local development — fail-closed everywhere
// else (test, staging, production, or any unexpected NODE_ENV), so a deploy that
// forgets ADMIN_EMAILS can never grant every signed-in user write access to the
// scoring source of truth. Set ADMIN_EMAILS to lock down dev too.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (adminEmails.size === 0) return env.NODE_ENV === "development";
  return Boolean(email && adminEmails.has(email.trim().toLowerCase()));
}
