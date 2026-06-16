// POST /api/cron/poll-odds-extras — slow-cadence companion to poll-odds. Fetches
// Over/Under totals + tournament-winner outrights and persists them. Called by the
// cron service near the top of each hour. Idempotent; no-op without ODDS_API_KEY.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pollOddsExtras } from "@/lib/odds/extras";
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
    const summary = await pollOddsExtras();
    return apiOk(summary);
  } catch (err) {
    console.error("poll-odds-extras failed:", err);
    return apiError(`poll failed: ${(err as Error).message}`, 502);
  }
}
