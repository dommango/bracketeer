import { describe, it, expect } from "vitest";
import { parseSquad, type ApiSquad } from "./squad-parse";

const squad: ApiSquad[] = [
  {
    players: [
      { name: "A. Forward", number: 9, position: "Attacker", age: 25 },
      { name: "B. Keeper", number: 1, position: "Goalkeeper", age: 30 },
      { name: "C. Back", number: 4, position: "Defender", age: 28 },
      { name: "D. Back", number: 2, position: "Defender", age: 22 },
      { name: "", number: 99, position: "Midfielder", age: 20 }, // dropped: no name
    ],
  },
];

describe("parseSquad", () => {
  it("sorts by position (GK→DEF→MID→FWD) then shirt number, dropping the nameless", () => {
    const out = parseSquad(squad);
    expect(out.map((p) => p.name)).toEqual(["B. Keeper", "D. Back", "C. Back", "A. Forward"]);
  });

  it("returns [] for an empty / not-yet-named squad", () => {
    expect(parseSquad(null)).toEqual([]);
    expect(parseSquad([])).toEqual([]);
    expect(parseSquad([{ players: [] }])).toEqual([]);
  });

  it("keeps unknown positions, sorting them last", () => {
    const out = parseSquad([
      { players: [{ name: "Coach?", number: null, position: "Manager", age: 50 }, { name: "GK", number: 1, position: "Goalkeeper", age: 29 }] },
    ]);
    expect(out.map((p) => p.name)).toEqual(["GK", "Coach?"]);
  });
});
