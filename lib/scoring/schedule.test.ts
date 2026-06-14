import { describe, it, expect } from "vitest";
import { HOST_CITIES, MATCH_CITY, venueFor } from "./schedule";

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
});
