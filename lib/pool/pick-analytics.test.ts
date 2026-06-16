import { describe, it, expect } from "vitest";
import { emptyPicks, type Picks } from "@/lib/scoring/types";
import { buildPickAnalytics, entrySelections } from "./pick-analytics";

// A bracket with just the fields the analytics read, on top of empty defaults.
function bracket(partial: {
  champion?: string;
  finalists?: [string, string];
  groupA?: string;
}): Picks {
  const p = emptyPicks();
  if (partial.champion) p.knockout[104] = partial.champion;
  if (partial.finalists) {
    p.knockout[101] = partial.finalists[0];
    p.knockout[102] = partial.finalists[1];
  }
  if (partial.groupA) p.groupFirst.A = partial.groupA;
  return p;
}

describe("buildPickAnalytics", () => {
  it("computes the consensus champion, percent, diversity, and contrarians", () => {
    const picks = [
      bracket({ champion: "BRA" }),
      bracket({ champion: "BRA" }),
      bracket({ champion: "ARG" }),
      bracket({ champion: "FRA" }),
    ];
    const a = buildPickAnalytics(picks);

    expect(a.totalEntries).toBe(4);
    expect(a.champion.top).toMatchObject({ code: "BRA", count: 2, pct: 50 });
    expect(a.champion.distinctCount).toBe(3); // BRA, ARG, FRA
    // Contrarians: champions picked exactly once (ARG, FRA), sorted by code.
    expect(a.contrarian.map((t) => t.code)).toEqual(["ARG", "FRA"]);
  });

  it("ranks finalists across both semi-final slots, desc then by code", () => {
    const picks = [
      bracket({ finalists: ["BRA", "FRA"] }),
      bracket({ finalists: ["BRA", "ARG"] }),
      bracket({ finalists: ["ARG", "FRA"] }),
    ];
    const a = buildPickAnalytics(picks);
    // BRA 2, ARG 2, FRA 2 → tie broken alphabetically.
    expect(a.finalists.map((t) => t.code)).toEqual(["ARG", "BRA", "FRA"]);
  });

  it("finds the most popular group winner per group", () => {
    const picks = [bracket({ groupA: "MEX" }), bracket({ groupA: "MEX" }), bracket({ groupA: "KOR" })];
    const a = buildPickAnalytics(picks);
    const groupA = a.groupWinners.find((g) => g.group === "A");
    expect(groupA?.top).toMatchObject({ code: "MEX", count: 2 });
    expect(a.groupWinners).toHaveLength(12); // A–L
  });

  it("returns zeroed fields for an empty pool", () => {
    const a = buildPickAnalytics([]);
    expect(a.totalEntries).toBe(0);
    expect(a.champion.top).toBeNull();
    expect(a.champion.distinctCount).toBe(0);
    expect(a.finalists).toEqual([]);
    expect(a.contrarian).toEqual([]);
    expect(a.groupWinners.every((g) => g.top === null)).toBe(true);
  });
});

describe("entrySelections", () => {
  it("derives champion, finalists, group winners, and awards", () => {
    const p = emptyPicks();
    p.knockout[104] = "BRA";
    p.knockout[101] = "BRA";
    p.knockout[102] = "FRA";
    p.groupFirst.A = "MEX";
    p.thirdAdvance = ["GHA"];
    p.awards.boot = "Kylian Mbappé";

    const s = entrySelections(p);
    expect(s.champion).toEqual({ code: "BRA", name: "Brazil" });
    expect(s.finalists.map((f) => f.code)).toEqual(["BRA", "FRA"]);
    expect(s.groupWinners.find((g) => g.group === "A")).toMatchObject({ code: "MEX" });
    expect(s.thirdAdvance).toEqual([{ code: "GHA", name: "Ghana" }]);
    expect(s.awards.find((a) => a.label === "Golden Boot")?.value).toBe("Kylian Mbappé");
  });

  it("renders dashes for missing picks", () => {
    const s = entrySelections(emptyPicks());
    expect(s.champion).toEqual({ code: null, name: "—" });
    expect(s.awards.every((a) => a.value === "—")).toBe(true);
  });
});
