// POST /api/cron/poll-topscorers — fetches the API-Football top-scorers board and
// replaces the TopScorer rows. One cheap call; runs hourly. Idempotent; no-op
// without SPORTS_API_KEY.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pollTopScorers } from "@/lib/sports/topscorers";
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
    const summary = await pollTopScorers();
    return apiOk(summary);
  } catch (err) {
    console.error("poll-topscorers failed:", err);
    return apiError(`poll failed: ${(err as Error).message}`, 502);
  }
}
