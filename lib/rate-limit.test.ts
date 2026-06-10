import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimitForTests } from "./rate-limit";

beforeEach(() => __resetRateLimitForTests());

describe("rateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    const t = 1_000_000;
    expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
  });

  it("blocks once the limit is exceeded, with a retry hint", () => {
    const t = 1_000_000;
    rateLimit("k", 2, 1000, t);
    rateLimit("k", 2, 1000, t);
    const res = rateLimit("k", 2, 1000, t + 100);
    expect(res.ok).toBe(false);
    expect(res.retryAfterMs).toBe(900);
  });

  it("resets after the window elapses", () => {
    const t = 1_000_000;
    rateLimit("k", 1, 1000, t);
    expect(rateLimit("k", 1, 1000, t + 500).ok).toBe(false);
    expect(rateLimit("k", 1, 1000, t + 1000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const t = 1_000_000;
    rateLimit("a", 1, 1000, t);
    expect(rateLimit("a", 1, 1000, t).ok).toBe(false);
    expect(rateLimit("b", 1, 1000, t).ok).toBe(true);
  });
});
