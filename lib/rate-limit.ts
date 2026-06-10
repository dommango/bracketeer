// Fixed-window rate limiter, in-process. Fine for the single-instance MVP web
// service; a horizontally-scaled deploy would need a shared store (Redis or a
// Postgres counter) instead. Keyed by an arbitrary string (e.g. "chat:<userId>").

interface Bucket {
  count: number;
  resetAt: number;
}

// Survive Next.js hot-reloads so counters aren't wiped on every edit in dev.
const globalForRl = globalThis as unknown as { rlBuckets?: Map<string, Bucket> };
const buckets = globalForRl.rlBuckets ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalForRl.rlBuckets = buckets;

// Drop expired buckets only once the map grows large, so memory can't grow
// unbounded under many distinct keys without paying a sweep on every call.
const SWEEP_THRESHOLD = 10_000;
function sweep(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

// Test-only: clear all buckets between cases.
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
