import { describe, it, expect } from "vitest";
import { emptyPicks, type Picks } from "@/lib/scoring/types";
import { teamBackers } from "./team-backers";
import type { EntryPicks } from "@/lib/pool/entry-picks";

// A bracket carrying just the fields a backing test exercises.
function bracket(partial: {
  champion?: string;
  finalists?: [string, string];
  ko?: Record<number, string>;
  groupFirst?: Record<string, string>;
  groupSecond?: Record<string, string>;
  thirds?: string[];
}): Picks {
  const p = emptyPicks();
  if (partial.champion) p.knockout[104] = partial.champion;
  if (partial.finalists) {
    p.knockout[101] = partial.finalists[0];
    p.knockout[102] = partial.finalists[1];
  }
  if (partial.ko) Object.assign(p.knockout, partial.ko);
  if (partial.groupFirst) Object.assign(p.groupFirst, partial.groupFirst);
  if (partial.groupSecond) Object.assign(p.groupSecond, partial.groupSecond);
  if (partial.thirds) p.thirdAdvance = partial.thirds as never;
  return p;
}

function entry(entryId: string, label: string, picks: Picks): EntryPicks {
  return { entryId, label, picks };
}

describe("teamBackers", () => {
  it("labels the deepest knockout stake per entry", () => {
    const entries = [
      entry("e1", "Alice", bracket({ champion: "BRA" })),
      entry("e2", "Bob", bracket({ finalists: ["BRA", "FRA"] })), // BRA to the final
      entry("e3", "Cara", bracket({ ko: { 97: "BRA" } })), // BRA wins a QF -> semifinalist
    ];
    const backers = teamBackers(entries, "BRA");
    expect(backers.map((b) => [b.label, b.as])).toEqual([
      ["Alice", "Champion"],
      ["Bob", "Finalist"],
      ["Cara", "Semifinalist"],
    ]);
  });

  it("maps each knockout round to the round reached", () => {
    const cases: [number, string][] = [
      [73, "Round of 16"],
      [89, "Quarterfinalist"],
      [97, "Semifinalist"],
      [101, "Finalist"],
      [104, "Champion"],
    ];
    for (const [matchNo, label] of cases) {
      const backers = teamBackers([entry("e", "E", bracket({ ko: { [matchNo]: "ARG" } }))], "ARG");
      expect(backers[0]?.as).toBe(label);
    }
  });

  it("ignores the unscored bronze match (103)", () => {
    const backers = teamBackers([entry("e", "E", bracket({ ko: { 103: "ARG" } }))], "ARG");
    expect(backers).toEqual([]);
  });

  it("falls back to the predicted group finish when there is no knockout stake", () => {
    const entries = [
      entry("e1", "Win", bracket({ groupFirst: { A: "MEX" } })),
      entry("e2", "Run", bracket({ groupSecond: { A: "MEX" } })),
      entry("e3", "Third", bracket({ thirds: ["MEX"] })),
    ];
    const backers = teamBackers(entries, "MEX");
    expect(backers.map((b) => b.as)).toEqual([
      "Group A winner", // depth 2 sorts ahead
      "Group A runner-up",
      "3rd → advances",
    ]);
  });

  it("prefers a knockout stake over a group finish for the same entry", () => {
    const e = entry("e", "E", bracket({ champion: "MEX", groupFirst: { A: "MEX" } }));
    expect(teamBackers([e], "MEX")[0]?.as).toBe("Champion");
  });

  it("omits entries that never staked the team and breaks depth ties alphabetically", () => {
    const entries = [
      entry("e1", "Zoe", bracket({ groupFirst: { A: "MEX" } })),
      entry("e2", "Ann", bracket({ groupFirst: { A: "MEX" } })),
      entry("e3", "Nope", bracket({ champion: "BRA" })),
    ];
    const backers = teamBackers(entries, "MEX");
    expect(backers.map((b) => b.label)).toEqual(["Ann", "Zoe"]);
  });
});
