import { describe, it, expect } from "vitest";
import {
  firstKnockoutKickoff,
  lastKnockoutKickoff,
  isDailyKnockoutGameOpen,
  dailyKnockoutMatchDay,
} from "./schedule";
import { kickoffFor } from "@/lib/scoring/schedule";

describe("daily-pickem knockout schedule", () => {
  it("anchors on the Round-of-32 opener and the Final", () => {
    expect(firstKnockoutKickoff()?.toISOString()).toBe(kickoffFor(73)?.toISOString());
    expect(lastKnockoutKickoff()?.toISOString()).toBe(kickoffFor(104)?.toISOString());
  });

  it("is open until the Final kicks off, then locked", () => {
    const final = lastKnockoutKickoff()!;
    expect(isDailyKnockoutGameOpen(new Date(final.getTime() - 1000))).toBe(true);
    expect(isDailyKnockoutGameOpen(final)).toBe(false);
    expect(isDailyKnockoutGameOpen(new Date(final.getTime() + 1000))).toBe(false);
  });

  it("is open well before the Round of 32 (players can pick early)", () => {
    const r32 = firstKnockoutKickoff()!;
    expect(isDailyKnockoutGameOpen(new Date(r32.getTime() - 86_400_000))).toBe(true);
  });

  it("buckets a fixture into its kickoff calendar day (Eastern time)", () => {
    // R32 match 73 kicks off 2026-06-28T19:00Z = 15:00 EDT → June 28.
    expect(dailyKnockoutMatchDay(73)).toBe("2026-06-28");
    // Final kicks off 2026-07-19T19:00Z = 15:00 EDT → July 19.
    expect(dailyKnockoutMatchDay(104)).toBe("2026-07-19");
  });
});
