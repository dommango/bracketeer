// POST /api/cron/poll-injuries — fetches API-Football /injuries for upcoming
// fixtures and upserts MatchInjury. Called by the cron service on a slow window
// (squad news moves slowly + is billed per fixture). Idempotent; no-op without
// SPORTS_API_KEY.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pollInjuries } from "@/lib/sports/injuries";
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
    const summary = await pollInjuries();
    return apiOk(summary);
  } catch (err) {
    console.error("poll-injuries failed:", err);
    return apiError(`poll failed: ${(err as Error).message}`, 502);
  }
}
