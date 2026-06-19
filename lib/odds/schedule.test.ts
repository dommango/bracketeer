import { describe, it, expect } from "vitest";
import {
  oddsTier,
  maxAgeForTier,
  oddsFetchDue,
  LIVE_MAX_AGE_MS,
  PREMATCH_MAX_AGE_MS,
} from "./schedule";

describe("oddsTier", () => {
  it("is live whenever a match is in play, even if another is imminent", () => {
    expect(oddsTier(true, true)).toBe("live");
    expect(oddsTier(true, false)).toBe("live");
  });

  it("is prematch when nothing is live but a match kicks off soon", () => {
    expect(oddsTier(false, true)).toBe("prematch");
  });

  it("is idle when nothing is live or imminent", () => {
    expect(oddsTier(false, false)).toBe("idle");
  });
});

describe("maxAgeForTier", () => {
  it("maps each tier to its refresh budget; idle never refreshes", () => {
    expect(maxAgeForTier("live")).toBe(LIVE_MAX_AGE_MS);
    expect(maxAgeForTier("prematch")).toBe(PREMATCH_MAX_AGE_MS);
    expect(maxAgeForTier("idle")).toBeNull();
  });
});

describe("oddsFetchDue", () => {
  const now = new Date("2026-06-18T20:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms);

  it("never fetches when idle (no max age), regardless of staleness", () => {
    expect(oddsFetchDue(null, null, now)).toBe(false);
    expect(oddsFetchDue(ago(24 * 60 * 60_000), null, now)).toBe(false);
  });

  it("bootstraps a fetch when no odds have been stored yet", () => {
    expect(oddsFetchDue(null, LIVE_MAX_AGE_MS, now)).toBe(true);
  });

  it("skips while the freshest row is still within the tier's max age", () => {
    expect(oddsFetchDue(ago(LIVE_MAX_AGE_MS - 60_000), LIVE_MAX_AGE_MS, now)).toBe(false);
  });

  it("fetches once the freshest row ages past the tier's max age", () => {
    expect(oddsFetchDue(ago(LIVE_MAX_AGE_MS), LIVE_MAX_AGE_MS, now)).toBe(true);
    expect(oddsFetchDue(ago(LIVE_MAX_AGE_MS + 60_000), LIVE_MAX_AGE_MS, now)).toBe(true);
  });

  it("treats the same row as stale for live but fresh for pre-match (slower budget)", () => {
    // A 30-min-old row is stale for the 10-min live tier but fresh for the 3-h
    // pre-match tier — same data, different cadence.
    const thirtyMin = ago(30 * 60_000);
    expect(oddsFetchDue(thirtyMin, LIVE_MAX_AGE_MS, now)).toBe(true);
    expect(oddsFetchDue(thirtyMin, PREMATCH_MAX_AGE_MS, now)).toBe(false);
  });
});
