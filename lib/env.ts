import { z } from "zod";

// Server-only configuration, validated once at import. Throwing here surfaces
// misconfiguration loudly at startup rather than at the first request.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars"),
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  // Email magic-link (SMTP). When absent, magic-link sign-in is disabled and
  // links are logged to the server console for local development.
  EMAIL_SERVER: z.string().default(""),
  EMAIL_FROM: z.string().default("Bracketeer <no-reply@bracketeer.app>"),
  CRON_SECRET: z.string().min(1),
  // Sports data API (optional — manual result entry works without it).
  SPORTS_API_KEY: z.string().default(""),
  SPORTS_API_BASE: z.string().default("https://v3.football.api-sports.io"),
});

export const env = schema.parse(process.env);

export const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
export const emailEnabled = Boolean(env.EMAIL_SERVER);
export const sportsApiEnabled = Boolean(env.SPORTS_API_KEY);
