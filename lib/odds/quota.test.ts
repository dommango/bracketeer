import { describe, it, expect, beforeEach } from "vitest";
import {
  recordQuota,
  quotaExhausted,
  quotaSnapshot,
  QUOTA_FLOOR,
  __resetQuotaForTest,
} from "./quota";

const headers = (h: Record<string, string>) => new Headers(h);

describe("odds quota tracker", () => {
  beforeEach(() => __resetQuotaForTest());

  it("reports not-exhausted before any response is seen (fails open on a fresh process)", () => {
    expect(quotaSnapshot().remaining).toBeNull();
    expect(quotaExhausted()).toBe(false);
  });

  it("records remaining + used from the Odds API headers", () => {
    recordQuota(headers({ "x-requests-remaining": "123", "x-requests-used": "377" }));
    expect(quotaSnapshot()).toMatchObject({ remaining: 123, used: 377 });
  });

  it("is exhausted strictly below the floor, fine at or above it", () => {
    recordQuota(headers({ "x-requests-remaining": String(QUOTA_FLOOR) }));
    expect(quotaExhausted()).toBe(false); // exactly the floor still spends

    recordQuota(headers({ "x-requests-remaining": String(QUOTA_FLOOR - 1) }));
    expect(quotaExhausted()).toBe(true);

    recordQuota(headers({ "x-requests-remaining": "500" }));
    expect(quotaExhausted()).toBe(false); // a fresh key clears the block
  });

  it("ignores missing/blank headers rather than recording NaN", () => {
    recordQuota(headers({ "x-requests-remaining": "80" }));
    recordQuota(headers({})); // e.g. a network-shaped response with no usage headers
    expect(quotaSnapshot().remaining).toBe(80); // last real reading preserved
    expect(quotaExhausted()).toBe(false);
  });
});
