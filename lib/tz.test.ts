import { describe, it, expect } from "vitest";
import { startOfDayInZone, matchdayKey, matchdaysAhead } from "@/lib/tz";
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

describe("matchdayKey (Eastern, pre-dawn rollover)", () => {
  it("keeps a normal WC kickoff on its Eastern calendar date", () => {
    // 19:00Z = 3pm EDT Jun 19 → matchday Jun 19.
    expect(matchdayKey(new Date("2026-06-19T19:00:00Z"))).toBe("2026-06-19");
  });

  it("folds a post-midnight Eastern instant into the previous matchday", () => {
    // 1:24am EDT Jun 19 (the time this feedback was filed) is still the Jun 18 slate.
    expect(matchdayKey(new Date("2026-06-19T05:24:00Z"))).toBe("2026-06-18");
  });

  it("treats a just-after-midnight ET kickoff as the current (prior) day", () => {
    // 12:30am EDT Jun 19 = 04:30Z → belongs to Jun 18, per 'after 12am ET = current day'.
    expect(matchdayKey(new Date("2026-06-19T04:30:00Z"))).toBe("2026-06-18");
  });
});

describe("matchdaysAhead (Eastern)", () => {
  const at124amJun19 = new Date("2026-06-19T05:24:00Z"); // 1:24am EDT

  it("reports noon-Jun-19 as one matchday ahead of 1:24am Jun 19 (today is exhausted)", () => {
    // The reported bug: at 1:24am the next game is the noon slate, which should read
    // as 'Tomorrow' (matchday Jun 18 → Jun 19), not as today.
    expect(matchdaysAhead(new Date("2026-06-19T16:00:00Z"), at124amJun19)).toBe(1);
  });

  it("reports a still-scheduled same-day evening game as 0 (today)", () => {
    const noonJun19 = new Date("2026-06-19T16:00:00Z"); // 12pm EDT
    const eveningJun19 = new Date("2026-06-20T01:00:00Z"); // 9pm EDT Jun 19
    expect(matchdaysAhead(eveningJun19, noonJun19)).toBe(0);
  });

  it("counts multi-day gaps (knockout rest days)", () => {
    expect(matchdaysAhead(new Date("2026-06-21T19:00:00Z"), new Date("2026-06-19T16:00:00Z"))).toBe(2);
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
