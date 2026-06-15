import { describe, it, expect } from "vitest";
import {
  cityTokenForEvent,
  resolveTicketMatchNo,
  wc2026Slots,
  type MatchSlot,
} from "@/lib/tickets/map";

const slots = wc2026Slots();
const slotFor = (matchNo: number): MatchSlot => {
  const s = slots.find((x) => x.matchNo === matchNo);
  if (!s) throw new Error(`no slot for ${matchNo}`);
  return s;
};

describe("cityTokenForEvent", () => {
  it("resolves by venue name (suburb-agnostic)", () => {
    expect(cityTokenForEvent({ startUtc: null, venueName: "MetLife Stadium", city: "x" })).toBe(
      "new-york-nj",
    );
    expect(cityTokenForEvent({ startUtc: null, venueName: "SoFi Stadium", city: "x" })).toBe(
      "los-angeles",
    );
    expect(cityTokenForEvent({ startUtc: null, venueName: "AT&T Stadium", city: "x" })).toBe(
      "dallas",
    );
  });

  it("falls back to the suburb/host city name when the venue is unknown", () => {
    expect(cityTokenForEvent({ startUtc: null, venueName: null, city: "East Rutherford" })).toBe(
      "new-york-nj",
    );
    expect(cityTokenForEvent({ startUtc: null, venueName: "Unknown Arena", city: "Inglewood" })).toBe(
      "los-angeles",
    );
  });

  it("returns null for an unrecognized venue + city", () => {
    expect(cityTokenForEvent({ startUtc: null, venueName: "Wembley", city: "London" })).toBeNull();
  });
});

describe("resolveTicketMatchNo", () => {
  it("maps a listing at the right venue and ~kickoff to its matchNo", () => {
    const s = slotFor(1);
    const ev = {
      startUtc: new Date(s.kickoffMs + 30 * 60_000).toISOString(), // 30 min off
      venueName: "Estadio Azteca",
      city: "Mexico City",
    };
    expect(resolveTicketMatchNo(ev, slots)).toBe(1);
  });

  it("rejects a listing whose start is far from any match at that venue", () => {
    const s = slotFor(1);
    const ev = {
      startUtc: new Date(s.kickoffMs + 5 * 24 * 60 * 60_000).toISOString(), // 5 days off
      venueName: "Estadio Azteca",
      city: "Mexico City",
    };
    expect(resolveTicketMatchNo(ev, slots)).toBeNull();
  });

  it("returns null when the city can't be identified", () => {
    expect(
      resolveTicketMatchNo({ startUtc: new Date().toISOString(), venueName: "?", city: "?" }, slots),
    ).toBeNull();
  });

  it("picks the closest match when one venue hosts several (different days)", () => {
    // Two real slots at the same venue should each resolve to themselves.
    const token = slotFor(1).cityToken;
    const sameVenue = slots.filter((s) => s.cityToken === token);
    expect(sameVenue.length).toBeGreaterThan(1);
    for (const s of sameVenue) {
      const ev = {
        startUtc: new Date(s.kickoffMs).toISOString(),
        venueName: "Estadio Azteca",
        city: "Mexico City",
      };
      expect(resolveTicketMatchNo(ev, slots)).toBe(s.matchNo);
    }
  });
});
