import { describe, it, expect } from "vitest";
import {
  parseFixturePlayers,
  playerOfTheMatch,
  type ApiFixturePlayerEntry,
  type PlayerStatLine,
} from "./fixture-players-parse";

// Two-team /fixtures/players payload, deliberately in away-then-home array order so
// the test proves assignment is by team id, not array position.
const RAW: ApiFixturePlayerEntry[] = [
  {
    team: { id: 20 }, // away
    players: [
      {
        player: { name: "Away Keeper" },
        statistics: [{ games: { minutes: 90, number: 1, position: "G", rating: "6.4", captain: false } }],
      },
    ],
  },
  {
    team: { id: 10 }, // home
    players: [
      {
        player: { name: "Home Star" },
        statistics: [
          {
            games: { minutes: 90, number: 10, position: "F", rating: "8.7", captain: true },
            goals: { total: 2, assists: 1 },
            shots: { total: 5, on: 3 },
            passes: { total: 41, accuracy: "88" },
          },
        ],
      },
      {
        player: { name: "Home Sub" },
        statistics: [{ games: { minutes: 12, number: 22, position: "M", rating: null, captain: false } }],
      },
    ],
  },
];

describe("parseFixturePlayers", () => {
  it("assigns squads to home/away by provider team id, not array order", () => {
    const out = parseFixturePlayers(RAW, 10, 20);
    expect(out).not.toBeNull();
    expect(out!.home.map((p) => p.name)).toEqual(["Home Star", "Home Sub"]);
    expect(out!.away.map((p) => p.name)).toEqual(["Away Keeper"]);
  });

  it("coerces the string rating/accuracy to numbers and keeps the rich fields", () => {
    const star = parseFixturePlayers(RAW, 10, 20)!.home[0];
    expect(star).toMatchObject<Partial<PlayerStatLine>>({
      name: "Home Star",
      number: 10,
      pos: "F",
      rating: 8.7,
      minutes: 90,
      goals: 2,
      assists: 1,
      shotsTotal: 5,
      shotsOn: 3,
      passes: 41,
      passAccuracy: 88,
      captain: true,
    });
  });

  it("returns null when a side can't be matched or fewer than two sides", () => {
    expect(parseFixturePlayers(RAW, 10, 999)).toBeNull();
    expect(parseFixturePlayers([RAW[0]], 10, 20)).toBeNull();
  });
});

describe("playerOfTheMatch", () => {
  it("picks the highest rating across both sides", () => {
    const { home, away } = parseFixturePlayers(RAW, 10, 20)!;
    const potm = playerOfTheMatch(home, away);
    expect(potm).toMatchObject({ side: "home" });
    expect(potm!.player.name).toBe("Home Star");
  });

  it("breaks a rating tie by minutes, then home", () => {
    const home: PlayerStatLine[] = [line("Home Eq", 7.5, 90), line("Home Low", 7.5, 60)];
    const away: PlayerStatLine[] = [line("Away Eq", 7.5, 90)];
    const potm = playerOfTheMatch(home, away);
    // Same rating + same minutes as Away Eq → home wins; Home Low has fewer minutes.
    expect(potm).toMatchObject({ side: "home" });
    expect(potm!.player.name).toBe("Home Eq");
  });

  it("returns null when no player has a rating", () => {
    expect(playerOfTheMatch([line("A", null, 90)], [line("B", null, 90)])).toBeNull();
  });
});

function line(name: string, rating: number | null, minutes: number | null): PlayerStatLine {
  return {
    name,
    number: null,
    pos: null,
    rating,
    minutes,
    goals: null,
    assists: null,
    shotsTotal: null,
    shotsOn: null,
    passes: null,
    passAccuracy: null,
    captain: false,
  };
}
