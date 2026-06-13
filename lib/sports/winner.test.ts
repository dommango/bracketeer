import { describe, it, expect } from "vitest";
import { resolveWinnerExternalId } from "./winner";
import type { FinishedFixture } from "./client";

function fixture(over: Partial<FinishedFixture>): FinishedFixture {
  return {
    fixtureId: 0,
    externalId: "1",
    scheduledAt: null,
    live: false,
    finished: true,
    elapsed: null,
    homeExternalId: "H",
    awayExternalId: "A",
    homeGoals: null,
    awayGoals: null,
    homePens: null,
    awayPens: null,
    ...over,
  };
}

describe("resolveWinnerExternalId", () => {
  it("picks the side with more goals in regulation/ET", () => {
    expect(resolveWinnerExternalId(fixture({ homeGoals: 2, awayGoals: 1 }))).toBe("H");
    expect(resolveWinnerExternalId(fixture({ homeGoals: 0, awayGoals: 3 }))).toBe("A");
  });

  it("resolves a penalty shootout when goals are level", () => {
    expect(
      resolveWinnerExternalId(fixture({ homeGoals: 1, awayGoals: 1, homePens: 4, awayPens: 5 })),
    ).toBe("A");
    expect(
      resolveWinnerExternalId(fixture({ homeGoals: 0, awayGoals: 0, homePens: 3, awayPens: 2 })),
    ).toBe("H");
  });

  it("returns null for a level score with no shootout", () => {
    expect(resolveWinnerExternalId(fixture({ homeGoals: 1, awayGoals: 1 }))).toBeNull();
  });

  it("returns null when no score is present", () => {
    expect(resolveWinnerExternalId(fixture({}))).toBeNull();
  });
});
