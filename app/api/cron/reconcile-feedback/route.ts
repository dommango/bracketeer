// POST /api/cron/reconcile-feedback — called by the Railway cron service with the
// shared secret. Pushes any feedback rows whose central-Notion page was never
// confirmed (the outbox). Idempotent (queries by App Row ID before creating) and a
// safe no-op when Notion isn't configured.

import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { reconcileFeedbackNotion } from "@/lib/notion/feedback-reconcile";
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
    const result = await reconcileFeedbackNotion();
    return apiOk(result);
  } catch (err) {
    console.error("reconcile-feedback failed:", err);
    return apiError(`reconcile failed: ${(err as Error).message}`, 502);
  }
}
