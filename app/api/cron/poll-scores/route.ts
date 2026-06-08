// POST /api/cron/poll-scores — called by the Railway cron service with the
// shared secret. Pulls finished fixtures and applies knockout winners (manual
// entries win). Idempotent; a safe no-op when no sports API is configured.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pollScores } from "@/lib/sports/poll";
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
    const summary = await pollScores();
    return apiOk(summary);
  } catch (err) {
    console.error("poll-scores failed:", err);
    return apiError(`poll failed: ${(err as Error).message}`, 502);
  }
}
