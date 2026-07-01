// POST /api/cron/poll-odds-props — called by the cron service every minute with the
// shared secret. Fetches per-event BTTS + anytime-goalscorer for matches at a
// snapshot moment and persists MatchProps + MatchScorerOdds. Self-throttling: makes
// zero Odds API calls unless a match is at a snapshot moment whose props haven't been
// captured (see lib/odds/per-match.ts). Idempotent; no-op without ODDS_API_KEY.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pollMatchProps } from "@/lib/odds/per-match";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Constant-time secret check (this endpoint is internet-reachable via the cron service).
function secretMatches(provided: string | null): boolean {
  const a = Buffer.from(provided ?? "");
  const b = Buffer.from(env.CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-cron-secret"))) {
    return apiError("unauthorized", 401);
  }
  try {
    const summary = await pollMatchProps();
    return apiOk(summary);
  } catch (err) {
    console.error("poll-odds-props failed:", err);
    return apiError(`poll failed: ${(err as Error).message}`, 502);
  }
}
