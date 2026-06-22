// POST /api/cron/resolve-prizes — called by the Railway cron worker with the
// shared secret. Records prize awards for any public challenge that has completed
// and notifies the winner. Idempotent (one award per challenge per tournament);
// a safe no-op until a challenge actually finishes.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { resolveChallengePrizes } from "@/lib/challenge/prizes";
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
    const summary = await resolveChallengePrizes();
    return apiOk({ resolutions: summary });
  } catch (err) {
    console.error("resolve-prizes failed:", err);
    return apiError(`resolve failed: ${(err as Error).message}`, 502);
  }
}
