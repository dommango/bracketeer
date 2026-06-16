import { describe, it, expect } from "vitest";
import { parseTopScorers, type ApiTopScorer } from "./topscorers-parse";

// Provider ids from EXTERNAL_TEAM_CODES: BRA=6, ARG=26.
function scorer(name: string, teamId: number, goals: number | null, assists?: number, apps?: number): ApiTopScorer {
  return {
    player: { name },
    statistics: [{ team: { id: teamId }, goals: { total: goals, assists: assists ?? null }, games: { appearences: apps ?? null } }],
  };
}

describe("parseTopScorers", () => {
  it("maps team codes, keeps order, and assigns gap-free ranks", () => {
    const out = parseTopScorers([
      scorer("Vinicius", 6, 5, 2, 4),
      scorer("Messi", 26, 4, 3, 4),
    ]);
    // toMatchObject ignores the `source` passthrough while asserting the parsed fields.
    expect(out).toMatchObject([
      { rank: 1, playerName: "Vinicius", teamCode: "BRA", goals: 5, assists: 2, appearances: 4 },
      { rank: 2, playerName: "Messi", teamCode: "ARG", goals: 4, assists: 3, appearances: 4 },
    ]);
    expect(out[0].source).toBeDefined(); // original provider row retained for audit
  });

  it("drops players with an unknown team or no goal count and re-ranks", () => {
    const out = parseTopScorers([
      scorer("Vinicius", 6, 5),
      scorer("Nobody", 99999, 4), // unknown team id → dropped
      { player: { name: "NoStats" } }, // no statistics → dropped
      scorer("Messi", 26, null), // null goals → dropped
      scorer("Julian", 26, 3),
    ]);
    expect(out.map((s) => s.playerName)).toEqual(["Vinicius", "Julian"]);
    expect(out.map((s) => s.rank)).toEqual([1, 2]); // gap-free after drops
  });

  it("returns empty for empty input", () => {
    expect(parseTopScorers([])).toEqual([]);
  });
});
