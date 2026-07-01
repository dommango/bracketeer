// Product-analytics event logging. One best-effort write per tracked engagement
// action — mirrors notifyPool (lib/realtime/notify.ts): callers await it (so the
// row flushes), but any failure is swallowed and must never break the operation
// that triggered it. It is a single indexed INSERT placed after any surrounding
// transaction closes, so the added latency is minimal and it never holds a lock.
// The admin dashboard (app/admin/analytics) aggregates these rows; the pure
// bucketing/rollup math lives in lib/analytics/aggregate.ts.

import { prisma } from "@/lib/db";
import type { AnalyticsEventType } from "@/generated/prisma/enums";

export interface LogEventInput {
  type: AnalyticsEventType;
  userId?: string | null;
  poolId?: string | null;
  tournamentId?: string | null;
  // Small context blob (e.g. { provider }, { format }, { replaced }). Omitted
  // when absent so the column stays NULL rather than JSON-null.
  metadata?: Record<string, unknown> | null;
}

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        poolId: input.poolId ?? null,
        tournamentId: input.tournamentId ?? null,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  } catch (err) {
    console.error("logEvent failed:", err);
  }
}
