import { describe, it, expect } from "vitest";
import { defaultOpenSection } from "./picks-summary";
import { firstMd3Kickoff } from "@/lib/pool/match-day-3";

// Just before the first MD3 kickoff, Match Day Pickem is joinable, so it is the
// featured game — making the featured branch deterministic for these cases.
const DURING_MD3 = new Date(firstMd3Kickoff().getTime() - 1000);

describe("defaultOpenSection", () => {
  it("opens the featured game when it still has picks to make", () => {
    expect(
      defaultOpenSection({ md3Incomplete: true, knockoutIncomplete: false, now: DURING_MD3 }),
    ).toBe("md3");
  });

  it("falls through to the other game when the featured one is complete", () => {
    expect(
      defaultOpenSection({ md3Incomplete: false, knockoutIncomplete: true, now: DURING_MD3 }),
    ).toBe("knockout");
  });

  it("defaults to the featured game when both are complete", () => {
    expect(
      defaultOpenSection({ md3Incomplete: false, knockoutIncomplete: false, now: DURING_MD3 }),
    ).toBe("md3");
  });
});
