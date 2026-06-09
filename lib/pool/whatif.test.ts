import { describe, it, expect } from "vitest";
import { projectStandings, type WhatIfEntry } from "./whatif";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";

function entry(entryId: string, label: string, knockout: Record<number, string>): WhatIfEntry {
  const picks: Picks = { ...emptyPicks(), knockout };
  return { entryId, label, picks };
}

const baseResults: Results = { ...emptyPicks(), knockout: {}, finalGoals: null };

describe("projectStandings", () => {
  it("awards the round's points only to entries who picked the hypothetical winner", () => {
    const rows = projectStandings(
      [entry("a", "Ana", { 73: "MEX" }), entry("b", "Bo", { 73: "CAN" })],
      baseResults,
      { matchNo: 73, winnerCode: "MEX" }, // R32 = 1 pt
    );
    const ana = rows.find((r) => r.entryId === "a")!;
    const bo = rows.find((r) => r.entryId === "b")!;
    expect(ana.delta).toBe(1);
    expect(bo.delta).toBe(0);
    expect(ana.total).toBe(1);
  });

  it("uses the round's weight (SF = 4 pts)", () => {
    const rows = projectStandings(
      [entry("a", "Ana", { 101: "BRA" })],
      baseResults,
      { matchNo: 101, winnerCode: "BRA" },
    );
    expect(rows[0].delta).toBe(4);
  });

  it("reflects the rank climb for the gainer", () => {
    // Zoe sorts last on the base tie (both 0 pts) → base rank 2, then climbs.
    const rows = projectStandings(
      [entry("a", "Ana", { 73: "CAN" }), entry("z", "Zoe", { 73: "MEX" })],
      baseResults,
      { matchNo: 73, winnerCode: "MEX" },
    );
    const zoe = rows.find((r) => r.entryId === "z")!;
    expect(zoe.baseRank).toBe(2);
    expect(zoe.rank).toBe(1);
    expect(zoe.rankDelta).toBe(1);
  });

  it("returns rows in projected-rank order", () => {
    const rows = projectStandings(
      [entry("a", "Ana", { 73: "CAN" }), entry("b", "Bo", { 73: "MEX" })],
      baseResults,
      { matchNo: 73, winnerCode: "MEX" },
    );
    expect(rows.map((r) => r.entryId)).toEqual(["b", "a"]); // Bo gains the point
  });

  it("can produce a negative delta when overriding an already-decided match", () => {
    const decided: Results = { ...emptyPicks(), knockout: { 73: "MEX" }, finalGoals: null };
    const rows = projectStandings(
      [entry("a", "Ana", { 73: "MEX" })],
      decided,
      { matchNo: 73, winnerCode: "CAN" }, // flip the winner away from Ana's pick
    );
    expect(rows[0].baseTotal).toBe(1);
    expect(rows[0].total).toBe(0);
    expect(rows[0].delta).toBe(-1);
  });
});
