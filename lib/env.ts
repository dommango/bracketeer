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
  // Giphy (optional — the GIF picker in chat disables cleanly without it).
  GIPHY_API_KEY: z.string().default(""),
  // Stripe billing (optional — premium upgrades disable cleanly without it).
  // All three are required to enable checkout + webhook handling.
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_PREMIUM: z.string().default(""),
});

export const env = schema.parse(process.env);

export const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
export const emailEnabled = Boolean(env.EMAIL_SERVER);
export const sportsApiEnabled = Boolean(env.SPORTS_API_KEY);
export const oddsApiEnabled = Boolean(env.ODDS_API_KEY);
export const giphyEnabled = Boolean(env.GIPHY_API_KEY);
// Stripe needs all three secrets to operate: the API key to create checkout
// sessions, the price id to subscribe to, and the webhook secret to trust
// incoming events. Missing any one disables billing (upgrade UI shows a notice).
export const stripeEnabled = Boolean(
  env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_PREMIUM,
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
