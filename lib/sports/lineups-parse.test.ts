import { describe, it, expect } from "vitest";
import { parseLineups, assignSides, type ApiLineupEntry, type LineupTeam } from "./lineups-parse";

describe("parseLineups", () => {
  it("normalizes team id, formation and starting XI", () => {
    const raw: ApiLineupEntry[] = [
      {
        team: { id: 6 },
        formation: "4-3-3",
        startXI: [
          { player: { name: "Alisson", number: 1, pos: "G" } },
          { player: { name: "Marquinhos", number: 4, pos: "D" } },
        ],
      },
      {
        team: { id: 16 },
        formation: "4-4-2",
        startXI: [{ player: { name: "Ochoa", number: 13, pos: "G" } }],
      },
    ];
    const out = parseLineups(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      teamId: 6,
      formation: "4-3-3",
      players: [
        { name: "Alisson", number: 1, pos: "G" },
        { name: "Marquinhos", number: 4, pos: "D" },
      ],
    });
    expect(out[1].teamId).toBe(16);
    expect(out[1].players).toHaveLength(1);
  });

  it("tolerates missing fields and empty input", () => {
    expect(parseLineups([])).toEqual([]);
    const out = parseLineups([{ team: {}, startXI: [{ player: {} }] }]);
    expect(out[0]).toEqual({
      teamId: null,
      formation: null,
      players: [{ name: null, number: null, pos: null }],
    });
  });
});

describe("assignSides", () => {
  // Provider ids from EXTERNAL_TEAM_CODES: BRA=6, ARG=26.
  const team = (teamId: number): LineupTeam => ({ teamId, formation: "4-3-3", players: [] });

  it("assigns by team id regardless of array order (never swaps)", () => {
    const ordered = assignSides([team(6), team(26)], "BRA", "ARG");
    const reversed = assignSides([team(26), team(6)], "BRA", "ARG");
    expect(ordered?.home.teamId).toBe(6);
    expect(ordered?.away.teamId).toBe(26);
    // Provider returning away-first must still resolve BRA→home, ARG→away.
    expect(reversed?.home.teamId).toBe(6);
    expect(reversed?.away.teamId).toBe(26);
  });

  it("returns null rather than guess when a code is unknown or missing", () => {
    expect(assignSides([team(6), team(26)], "BRA", "ZZZ")).toBeNull();
    expect(assignSides([team(6), team(26)], null, "ARG")).toBeNull();
  });

  it("returns null when both sides collapse to one team", () => {
    expect(assignSides([team(6)], "BRA", "ARG")).toBeNull(); // ARG not present
    expect(assignSides([team(6), team(26)], "BRA", "BRA")).toBeNull();
  });
});
