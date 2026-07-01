import { describe, it, expect } from "vitest";
import { parseEventBtts, parseEventScorers } from "./event-parse";

// The per-event odds endpoint returns a single event object (not an array) whose
// bookmakers carry the requested additional markets.
function event(markets: { key: string; outcomes: unknown[] }[]) {
  return {
    home_team: "Brazil",
    away_team: "Mexico",
    commence_time: "2026-07-04T19:00:00Z",
    bookmakers: markets.map((m) => ({ markets: [m] })),
  };
}

describe("parseEventBtts", () => {
  it("medians Yes/No across every bookmaker", () => {
    const ev = {
      home_team: "Brazil",
      away_team: "Mexico",
      commence_time: "2026-07-04T19:00:00Z",
      bookmakers: [
        { markets: [{ key: "btts", outcomes: [{ name: "Yes", price: 1.8 }, { name: "No", price: 2.0 }] }] },
        { markets: [{ key: "btts", outcomes: [{ name: "Yes", price: 1.9 }, { name: "No", price: 1.95 }] }] },
        { markets: [{ key: "btts", outcomes: [{ name: "Yes", price: 2.0 }, { name: "No", price: 1.85 }] }] },
      ],
    };
    expect(parseEventBtts(ev as never)).toEqual({ decimalYes: 1.9, decimalNo: 1.95 });
  });

  it("returns null when no book quotes a btts market", () => {
    const ev = event([{ key: "h2h", outcomes: [{ name: "Brazil", price: 2 }] }]);
    expect(parseEventBtts(ev as never)).toBeNull();
  });

  it("returns null for a missing event", () => {
    expect(parseEventBtts(undefined)).toBeNull();
  });
});

describe("parseEventScorers", () => {
  const book = (outcomes: unknown[]) => ({
    markets: [{ key: "player_goal_scorer_anytime", outcomes }],
  });

  it("medians each player's price across books and reads the player from `description`", () => {
    const ev = {
      home_team: "Brazil",
      away_team: "Mexico",
      commence_time: "2026-07-04T19:00:00Z",
      bookmakers: [
        book([
          { name: "Yes", description: "Vinicius Junior", price: 2.4 },
          { name: "Yes", description: "Raphinha", price: 3.0 },
        ]),
        book([
          { name: "Yes", description: "Vinicius Junior", price: 2.6 },
          { name: "Yes", description: "Raphinha", price: 3.2 },
        ]),
      ],
    };
    expect(parseEventScorers(ev as never)).toEqual([
      { playerName: "Vinicius Junior", decimal: 2.5 },
      { playerName: "Raphinha", decimal: 3.1 },
    ]);
  });

  it("falls back to `name` when there is no description, and skips generic selections", () => {
    const ev = {
      home_team: "Brazil",
      away_team: "Mexico",
      commence_time: "2026-07-04T19:00:00Z",
      bookmakers: [
        book([
          { name: "Rodrygo", price: 2.8 },
          { name: "Yes", price: 1.5 }, // generic, no player → skipped
        ]),
      ],
    };
    expect(parseEventScorers(ev as never)).toEqual([{ playerName: "Rodrygo", decimal: 2.8 }]);
  });

  it("returns empty when no book quotes the scorer market", () => {
    const ev = event([{ key: "btts", outcomes: [{ name: "Yes", price: 1.8 }] }]);
    expect(parseEventScorers(ev as never)).toEqual([]);
  });
});
