// Pure fixed-window rate-limit decision — no I/O, no DB, no clock. Split from
// rate-limit.ts (which imports the DB) so the window math stays unit-testable in
// isolation. The async rateLimit wrapper persists `next` and returns `result`.

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export interface Bucket {
  count: number;
  resetAt: number;
}

export interface Decision {
  result: RateLimitResult;
  next: Bucket;
}

// Given the stored bucket (or null) decide whether this request is allowed and
// what the bucket should become. `now` is injected so the rule is deterministic.
export function decideRateLimit(
  prev: Bucket | null,
  limit: number,
  windowMs: number,
  now: number,
): Decision {
  if (!prev || now >= prev.resetAt) {
    const next = { count: 1, resetAt: now + windowMs };
    return { result: { ok: true, retryAfterMs: 0 }, next };
  }
  if (prev.count >= limit) {
    return { result: { ok: false, retryAfterMs: prev.resetAt - now }, next: prev };
  }
  return { result: { ok: true, retryAfterMs: 0 }, next: { count: prev.count + 1, resetAt: prev.resetAt } };
}
