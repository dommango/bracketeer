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
    // Base match 73 = CAN, so Ana (picked CAN) leads at 1 pt and Zoe trails at 0.
    // Flipping the winner to MEX hands Zoe the point and she overtakes Ana.
    const decided: Results = { ...emptyPicks(), knockout: { 73: "CAN" }, finalGoals: null };
    const rows = projectStandings(
      [entry("a", "Ana", { 73: "CAN" }), entry("z", "Zoe", { 73: "MEX" })],
      decided,
      { matchNo: 73, winnerCode: "MEX" },
    );
    const zoe = rows.find((r) => r.entryId === "z")!;
    expect(zoe.baseRank).toBe(2);
    expect(zoe.rank).toBe(1);
    expect(zoe.rankDelta).toBe(1);
  });

  it("gives tied entries the same place (standard competition ranking)", () => {
    // Both pick the hypothetical winner → both gain the point → both tied at 1.
    const rows = projectStandings(
      [entry("a", "Ana", { 73: "MEX" }), entry("z", "Zoe", { 73: "MEX" })],
      baseResults,
      { matchNo: 73, winnerCode: "MEX" },
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
    expect(rows.every((r) => r.baseRank === 1)).toBe(true);
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
