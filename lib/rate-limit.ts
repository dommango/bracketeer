// Shared, cross-instance fixed-window rate limiter. State lives in the Postgres
// `RateLimit` table (not an in-process Map), so per-key limits hold across
// horizontally-scaled web replicas. The window decision is a pure function
// (decideRateLimit in rate-limit-core.ts, unit-tested without a DB); this wrapper
// reads+writes the shared counter under a per-key advisory lock so concurrent
// requests for the same key can't race past the limit. Keyed by an arbitrary
// string (e.g. "chat:<userId>").

import { prisma } from "@/lib/db";
import { decideRateLimit, type Bucket, type RateLimitResult } from "@/lib/rate-limit-core";

export type { RateLimitResult } from "@/lib/rate-limit-core";

// Throttle a best-effort sweep of expired rows so the table can't grow unbounded
// under many distinct keys, without paying a delete on every call.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweepAt = 0;
function maybeSweep(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  // Fire-and-forget — a failed prune must never affect the caller.
  prisma.rateLimit
    .deleteMany({ where: { expiresAt: { lt: new Date(now) } } })
    .catch(() => {});
}

// Consume one unit against `key`. Atomic per key via a transaction-scoped advisory
// lock (same pattern as lib/pool/scoring.ts), so the read→decide→write can't
// interleave with a concurrent request for the same key.
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  maybeSweep(now);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"rl:" + key}))`;
      const row = await tx.rateLimit.findUnique({ where: { key } });
      const prev: Bucket | null = row ? { count: row.count, resetAt: row.expiresAt.getTime() } : null;
      const { result, next } = decideRateLimit(prev, limit, windowMs, now);
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: next.count, expiresAt: new Date(next.resetAt) },
        update: { count: next.count, expiresAt: new Date(next.resetAt) },
      });
      return result;
    });
  } catch (err) {
    // Fail OPEN: a transient DB error (pool exhaustion, lock-wait timeout) must not
    // take down sign-in or every mutation path that now awaits this. Throttling is
    // soft protection, not a security control, so availability wins. Logged so a
    // persistent failure is visible rather than silently disabling all limits.
    console.error(`rateLimit("${key}") failed — allowing request:`, err);
    return { ok: true, retryAfterMs: 0 };
  }
}
