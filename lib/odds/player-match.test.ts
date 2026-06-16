import { describe, it, expect } from "vitest";
import { matchPlayerCode, normPlayer, type BoardPlayer } from "./player-match";

const board: BoardPlayer[] = [
  { playerName: "Kylian Mbappé", teamCode: "FRA" },
  { playerName: "Erling Haaland", teamCode: "NOR" },
  { playerName: "Thiago Silva", teamCode: "BRA" },
  { playerName: "Bernardo Silva", teamCode: "POR" }, // shared surname, different team
];

describe("normPlayer", () => {
  it("lowercases, strips accents, and collapses dots/spaces", () => {
    expect(normPlayer("K. Mbappé")).toBe("k mbappe");
    expect(normPlayer("Kylian  Mbappé")).toBe("kylian mbappe");
  });
});

describe("matchPlayerCode", () => {
  it("matches the abbreviated-forename convention via surname", () => {
    expect(matchPlayerCode("K. Mbappé", board)).toBe("FRA");
    expect(matchPlayerCode("E. Haaland", board)).toBe("NOR");
  });

  it("matches on exact normalized full name", () => {
    expect(matchPlayerCode("Kylian Mbappe", board)).toBe("FRA");
  });

  it("returns null for an ambiguous surname shared across teams (never a wrong flag)", () => {
    expect(matchPlayerCode("T. Silva", board)).toBeNull();
    expect(matchPlayerCode("Silva", board)).toBeNull();
  });

  it("returns null for an unknown player and empty input", () => {
    expect(matchPlayerCode("L. Messi", board)).toBeNull();
    expect(matchPlayerCode("", board)).toBeNull();
    expect(matchPlayerCode("K. Mbappé", [])).toBeNull();
  });
});
