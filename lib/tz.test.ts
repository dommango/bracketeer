import { describe, it, expect } from "vitest";
import { startOfDayInZone } from "@/lib/tz";
import { formatKickoff } from "@/lib/pool/format";

describe("startOfDayInZone (Eastern)", () => {
  it("rolls over at Eastern midnight, not UTC midnight (EDT)", () => {
    // 02:30Z on Jun 14 is still Jun 13 in Eastern (22:30 EDT) → Eastern day = Jun 13,
    // whose midnight is 04:00Z (EDT is UTC−4).
    const now = new Date("2026-06-14T02:30:00Z");
    expect(startOfDayInZone(now).toISOString()).toBe("2026-06-13T04:00:00.000Z");
  });

  it("returns the same Eastern day's midnight for a daytime instant (EDT)", () => {
    const now = new Date("2026-06-14T12:00:00Z"); // 08:00 EDT Jun 14
    expect(startOfDayInZone(now).toISOString()).toBe("2026-06-14T04:00:00.000Z");
  });

  it("handles standard time (EST, UTC−5) in winter", () => {
    const now = new Date("2026-01-15T02:00:00Z"); // 21:00 EST Jan 14
    expect(startOfDayInZone(now).toISOString()).toBe("2026-01-14T05:00:00.000Z");
  });
});

describe("formatKickoff (Eastern)", () => {
  it("renders a UTC instant in Eastern time with the zone abbreviation", () => {
    // 19:00Z = 15:00 EDT.
    const out = formatKickoff("2026-06-27T19:00:00Z");
    expect(out).toContain("Jun 27");
    expect(out).toContain("3:00");
    expect(out).toContain("PM");
    expect(out).toContain("EDT");
  });
});
