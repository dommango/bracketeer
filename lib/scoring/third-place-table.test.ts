import { describe, it, expect } from "vitest";
import { THIRD_PLACE_TABLE, THIRD_PLACE_MATCH_ORDER } from "./third-place-table";
import { resolveR32Slots } from "./resolve";
import { GROUPS } from "./data";
import { emptyPicks, type GroupLetter, type Picks } from "./types";

const groups = Object.keys(GROUPS) as GroupLetter[];

// Legal third-place group set per match (mirrors data.ts R32 third slots).
const ALLOWED: Record<number, string[]> = {
  74: ["A", "B", "C", "D", "F"],
  77: ["C", "D", "F", "G", "H"],
  79: ["C", "E", "F", "H", "I"],
  80: ["E", "H", "I", "J", "K"],
  81: ["B", "E", "F", "I", "J"],
  82: ["A", "E", "H", "I", "J"],
  85: ["E", "F", "G", "I", "J"],
  87: ["D", "E", "I", "J", "L"],
};

function allCombos(): string[] {
  const G = "ABCDEFGHIJKL".split("");
  const out: string[] = [];
  (function pick(start: number, acc: string[]) {
    if (acc.length === 8) return void out.push(acc.join(""));
    for (let i = start; i < G.length; i++) pick(i + 1, [...acc, G[i]]);
  })(0, []);
  return out;
}

describe("THIRD_PLACE_TABLE (FIFA Annex C)", () => {
  it("covers all 495 combinations exactly once", () => {
    const keys = Object.keys(THIRD_PLACE_TABLE);
    expect(keys.length).toBe(495);
    expect(new Set(keys).size).toBe(495);
    expect([...keys].sort()).toEqual(allCombos());
  });

  it("every row is a legal bijection into the 8 third-place matches", () => {
    for (const [key, value] of Object.entries(THIRD_PLACE_TABLE)) {
      expect(value.length).toBe(8);
      // value groups (a permutation of the key) each legal for their match
      expect([...value].sort().join("")).toBe(key);
      THIRD_PLACE_MATCH_ORDER.forEach((mid, i) => {
        expect(ALLOWED[mid]).toContain(value[i]);
      });
    }
  });

  it("matches independently-confirmed Annex C rows", () => {
    expect(THIRD_PLACE_TABLE.BDEFIJKL).toBe("DFEKBIJL"); // row 67* — real WC2026 combo
    expect(THIRD_PLACE_TABLE.EFGHIJKL).toBe("FGEKIHJL"); // row 1
    expect(THIRD_PLACE_TABLE.DFGHIJKL).toBe("DFHKIJGL"); // row 2
    expect(THIRD_PLACE_TABLE.DEGHIJKL).toBe("DGEKIHJL"); // row 3
    expect(THIRD_PLACE_TABLE.DEFGHIJK).toBe("DFEKJHGI"); // row 9
    expect(THIRD_PLACE_TABLE.ABDEFIJK).toBe("DFEKBAJI"); // row 353
  });
});

describe("resolveR32Slots with the real WC2026 third-place combo", () => {
  // The eight qualifying thirds come from groups B, D, E, F, I, J, K, L.
  const picks: Picks = {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: (["B", "D", "E", "F", "I", "J", "K", "L"] as GroupLetter[]).map(
      (g) => GROUPS[g][2],
    ),
  };

  const teamGroup: Record<string, GroupLetter> = {};
  for (const g of groups) for (const t of GROUPS[g]) teamGroup[t] = g;

  it("seats each third into its official match (fixes M82 Senegal, M85 Algeria)", () => {
    const resolved = resolveR32Slots(picks);
    const groupAt = (mid: number) => teamGroup[resolved[mid].b as string];

    // Official Annex C seating for BDEFIJKL -> DFEKBIJL
    expect(groupAt(74)).toBe("D");
    expect(groupAt(77)).toBe("F");
    expect(groupAt(79)).toBe("E");
    expect(groupAt(80)).toBe("K");
    expect(groupAt(81)).toBe("B");
    expect(groupAt(82)).toBe("I"); // group I's third (Senegal) — NOT group J (Algeria)
    expect(groupAt(85)).toBe("J"); // group J's third (Algeria)
    expect(groupAt(87)).toBe("L");
  });
});
