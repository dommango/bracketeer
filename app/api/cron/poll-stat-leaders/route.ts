// POST /api/cron/poll-stat-leaders — fetches the API-Football assist + disciplinary
// boards and replaces the StatLeader rows per category. Three cheap calls; runs
// hourly beside poll-topscorers. Idempotent; no-op without SPORTS_API_KEY.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { pollStatLeaders } from "@/lib/sports/stat-leaders";
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
    const summary = await pollStatLeaders();
    return apiOk(summary);
  } catch (err) {
    console.error("poll-stat-leaders failed:", err);
    return apiError(`poll failed: ${(err as Error).message}`, 502);
  }
}
