import { describe, it, expect } from "vitest";
import { buildStadiums, getStadium, matchup } from "./stadiums";
import { TEAMS } from "@/lib/scoring/data";

describe("buildStadiums", () => {
  const stadiums = buildStadiums();
  const teamNames = new Set(Object.values(TEAMS));

  it("returns the 16 host venues", () => {
    expect(stadiums).toHaveLength(16);
  });

  it("buckets all 104 matches exactly once", () => {
    const total = stadiums.reduce((sum, s) => sum + s.matches.length, 0);
    expect(total).toBe(104);
    const seen = new Set(stadiums.flatMap((s) => s.matches.map((m) => m.matchNo)));
    expect(seen.size).toBe(104);
  });

  it("gives every stadium a city, venue, and at least one match", () => {
    for (const s of stadiums) {
      expect(s.city.length).toBeGreaterThan(0);
      expect(s.venue.length).toBeGreaterThan(0);
      expect(s.matches.length).toBeGreaterThan(0);
    }
  });

  it("orders each stadium's matches by non-decreasing kickoff", () => {
    for (const s of stadiums) {
      const kickoffs = s.matches.map((m) => m.kickoff).filter((k): k is string => k !== null);
      const sorted = [...kickoffs].sort();
      expect(kickoffs).toEqual(sorted);
    }
  });

  it("resolves group-stage match 1 to two real team names", () => {
    const { home, away } = matchup(1);
    expect(teamNames.has(home)).toBe(true);
    expect(teamNames.has(away)).toBe(true);
  });

  it("getStadium('seattle') returns Lumen Field", () => {
    const seattle = getStadium("seattle");
    expect(seattle).not.toBeNull();
    expect(seattle?.venue).toBe("Lumen Field");
  });

  it("getStadium returns null for an unknown token", () => {
    expect(getStadium("narnia")).toBeNull();
  });
});
