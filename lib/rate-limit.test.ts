import { describe, it, expect } from "vitest";
import { decideRateLimit } from "./rate-limit-core";

// The window math is the pure, unit-tested core; the async rateLimit wrapper just
// persists `next` and returns `result` under an advisory lock.
describe("decideRateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    const t = 1_000_000;
    let bucket = null as { count: number; resetAt: number } | null;
    for (let i = 0; i < 3; i++) {
      const { result, next } = decideRateLimit(bucket, 3, 1000, t);
      expect(result.ok).toBe(true);
      bucket = next;
    }
    expect(bucket).toEqual({ count: 3, resetAt: t + 1000 });
  });

  it("blocks once the limit is exceeded, with a retry hint", () => {
    const t = 1_000_000;
    let { next } = decideRateLimit(null, 2, 1000, t);
    ({ next } = decideRateLimit(next, 2, 1000, t));
    const { result } = decideRateLimit(next, 2, 1000, t + 100);
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBe(900);
  });

  it("resets after the window elapses", () => {
    const t = 1_000_000;
    const { next } = decideRateLimit(null, 1, 1000, t);
    expect(decideRateLimit(next, 1, 1000, t + 500).result.ok).toBe(false);
    expect(decideRateLimit(next, 1, 1000, t + 1000).result.ok).toBe(true);
  });

  it("does not advance the bucket when blocked", () => {
    const t = 1_000_000;
    const { next } = decideRateLimit(null, 1, 1000, t);
    const blocked = decideRateLimit(next, 1, 1000, t + 500);
    expect(blocked.next).toEqual(next); // unchanged while blocked
  });
});
