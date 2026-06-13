import { describe, it, expect } from "vitest";
import { computeGroupTables, type GroupResultRow } from "./group-table";

// Group A = ["MEX", "RSA", "KOR", "CZE"]
const m = (homeCode: string, awayCode: string, homeScore: number, awayScore: number): GroupResultRow => ({
  homeCode,
  awayCode,
  homeScore,
  awayScore,
});

const rankOf = (rows: ReturnType<typeof computeGroupTables>["A"], code: string) =>
  rows.find((r) => r.code === code)!;

describe("computeGroupTables", () => {
  it("ranks by points, then GD, then goals scored", () => {
    // MEX 3pts (+1), KOR 3pts (+1) but KOR scored more; RSA/CZE 0 pts.
    const t = computeGroupTables([
      m("MEX", "RSA", 1, 0), // MEX +1, 1 GF
      m("KOR", "CZE", 3, 2), // KOR +1, 3 GF
    ]).A;
    expect(t.map((r) => r.code)).toEqual(["KOR", "MEX", "CZE", "RSA"]);
    expect(rankOf(t, "KOR").rank).toBe(1);
    expect(rankOf(t, "MEX").rank).toBe(2);
    expect(rankOf(t, "KOR").tied).toBe(false);
  });

  it("breaks an overall tie by head-to-head result", () => {
    // MEX & KOR both 1-0 over the others (3pts, +1, 1 GF). Head-to-head: MEX beat KOR.
    const t = computeGroupTables([
      m("MEX", "RSA", 1, 0),
      m("KOR", "CZE", 1, 0),
      m("MEX", "KOR", 1, 0), // H2H decides
    ]).A;
    expect(rankOf(t, "MEX").rank).toBe(1);
    expect(rankOf(t, "KOR").rank).toBe(2);
    expect(rankOf(t, "MEX").tied).toBe(false);
  });

  it("flags all three tied in a head-to-head cycle", () => {
    // MEX>RSA, RSA>KOR, KOR>MEX — each 3pts, GD 0, 1 GF; H2H among them all equal.
    const t = computeGroupTables([
      m("MEX", "RSA", 1, 0),
      m("RSA", "KOR", 1, 0),
      m("KOR", "MEX", 1, 0),
    ]).A;
    expect(rankOf(t, "MEX").tied).toBe(true);
    expect(rankOf(t, "RSA").tied).toBe(true);
    expect(rankOf(t, "KOR").tied).toBe(true);
    expect(rankOf(t, "MEX").rank).toBe(1);
    expect(rankOf(t, "RSA").rank).toBe(1);
    expect(rankOf(t, "KOR").rank).toBe(1);
    // CZE played nothing → behind the cycle at rank 4.
    expect(rankOf(t, "CZE").rank).toBe(4);
  });

  it("ignores invalid pairs and rows missing a score", () => {
    const t = computeGroupTables([
      m("MEX", "BRA", 5, 0), // BRA not in group A → ignored
      { homeCode: "MEX", awayCode: "RSA", homeScore: 1, awayScore: null as unknown as number },
    ]).A;
    // No counted matches → everyone 0/0/0 and tied at rank 1.
    expect(t.every((r) => r.played === 0)).toBe(true);
    expect(t.every((r) => r.tied)).toBe(true);
  });

  it("returns a table for every one of the 12 groups", () => {
    const tables = computeGroupTables([]);
    expect(Object.keys(tables).sort()).toEqual(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
    );
  });
});
