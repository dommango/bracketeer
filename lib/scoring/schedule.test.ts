import { describe, it, expect } from "vitest";
import { HOST_CITIES, MATCH_CITY, MATCH_KICKOFF_UTC, venueFor, kickoffFor } from "./schedule";

const PALETTE_TOKENS = [
  "atlanta", "boston", "dallas", "guadalajara", "houston", "kansas-city",
  "los-angeles", "mexico-city", "miami", "monterrey", "new-york-nj",
  "philadelphia", "san-francisco", "seattle", "toronto", "vancouver",
];

describe("schedule", () => {
  it("defines all 16 host cities with matching palette tokens", () => {
    expect(Object.keys(HOST_CITIES).sort()).toEqual([...PALETTE_TOKENS].sort());
    for (const c of Object.values(HOST_CITIES)) {
      expect(c.city.length).toBeGreaterThan(0);
      expect(c.venue.length).toBeGreaterThan(0);
    }
  });
  it("maps every match 1–104 to a known city token", () => {
    for (let n = 1; n <= 104; n++) {
      const token = MATCH_CITY[n];
      expect(token, `match ${n} missing`).toBeTruthy();
      expect(HOST_CITIES[token], `match ${n} token ${token} not in HOST_CITIES`).toBeTruthy();
    }
    expect(Object.keys(MATCH_CITY)).toHaveLength(104);
  });
  it("venueFor returns derived venue/city or null", () => {
    const v = venueFor(104);
    expect(v).not.toBeNull();
    expect(v!.cityToken in HOST_CITIES).toBe(true);
    expect(venueFor(999)).toBeNull();
  });
  it("defines a kickoff instant for every match 1–104, all in the tournament window", () => {
    expect(Object.keys(MATCH_KICKOFF_UTC)).toHaveLength(104);
    // Opener (match 1) and final (match 104) anchor the window.
    const open = new Date("2026-06-11T00:00:00Z").getTime();
    const close = new Date("2026-07-20T00:00:00Z").getTime();
    for (let n = 1; n <= 104; n++) {
      const d = kickoffFor(n);
      expect(d, `match ${n} missing kickoff`).not.toBeNull();
      expect(Number.isNaN(d!.getTime()), `match ${n} invalid date`).toBe(false);
      expect(d!.getTime(), `match ${n} outside window`).toBeGreaterThanOrEqual(open);
      expect(d!.getTime(), `match ${n} outside window`).toBeLessThan(close);
    }
    // Matches are non-decreasing by matchNo within the group stage roll-out is
    // not guaranteed, but the final must be the last kickoff.
    const finalTs = kickoffFor(104)!.getTime();
    for (let n = 1; n < 104; n++) {
      expect(kickoffFor(n)!.getTime(), `match ${n} after final`).toBeLessThanOrEqual(finalTs);
    }
  });
  it("kickoffFor returns null for unknown match numbers", () => {
    expect(kickoffFor(0)).toBeNull();
    expect(kickoffFor(999)).toBeNull();
  });
});
