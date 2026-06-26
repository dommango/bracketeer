import { describe, it, expect } from "vitest";
import { buildMd3Tiebreak, compareMd3Tiebreak, parseMd3Tiebreak } from "./md3-tiebreak";

describe("buildMd3Tiebreak", () => {
  it("counts each scoring tier from the per-pick map", () => {
    const perPick = { M1: 5, M2: 5, M3: 3, M4: 1, M5: 0, M6: 1 };
    expect(buildMd3Tiebreak(perPick, 14, 11)).toEqual({
      exact: 2,
      gd: 1,
      result: 2,
      goalDelta: 3,
    });
  });

  it("is all zeros for an unscored entry", () => {
    expect(buildMd3Tiebreak({}, 0, 0)).toEqual({ exact: 0, gd: 0, result: 0, goalDelta: 0 });
  });

  it("takes the absolute goal delta (over- and under-prediction are equal)", () => {
    expect(buildMd3Tiebreak({}, 10, 13).goalDelta).toBe(3);
    expect(buildMd3Tiebreak({}, 13, 10).goalDelta).toBe(3);
  });
});

describe("compareMd3Tiebreak", () => {
  const base = { exact: 2, gd: 2, result: 2, goalDelta: 4 };

  it("ranks more exact scorelines ahead first", () => {
    expect(compareMd3Tiebreak({ ...base, exact: 3 }, base)).toBeLessThan(0);
    expect(compareMd3Tiebreak(base, { ...base, exact: 3 })).toBeGreaterThan(0);
  });

  it("falls through to goal-difference hits, then correct results", () => {
    expect(compareMd3Tiebreak({ ...base, gd: 3 }, base)).toBeLessThan(0);
    expect(compareMd3Tiebreak({ ...base, result: 3 }, base)).toBeLessThan(0);
  });

  it("breaks a full tie on the closest aggregate goals (lower delta wins)", () => {
    expect(compareMd3Tiebreak({ ...base, goalDelta: 1 }, { ...base, goalDelta: 5 })).toBeLessThan(0);
  });

  it("is a dead heat when every component matches", () => {
    expect(compareMd3Tiebreak({ ...base }, { ...base })).toBe(0);
  });

  it("is neutral (0) when either side is undefined", () => {
    expect(compareMd3Tiebreak(undefined, base)).toBe(0);
    expect(compareMd3Tiebreak(base, undefined)).toBe(0);
    expect(compareMd3Tiebreak(undefined, undefined)).toBe(0);
  });
});

describe("parseMd3Tiebreak", () => {
  it("reads the tb block off a cached byCategory blob", () => {
    const byCategory = { md3: 27, tb: { exact: 2, gd: 1, result: 3, goalDelta: 4 } };
    expect(parseMd3Tiebreak(byCategory)).toEqual({ exact: 2, gd: 1, result: 3, goalDelta: 4 });
  });

  it("returns undefined for a pre-tiebreak breakdown", () => {
    expect(parseMd3Tiebreak({ md3: 27 })).toBeUndefined();
  });

  it("returns undefined for malformed input", () => {
    expect(parseMd3Tiebreak(null)).toBeUndefined();
    expect(parseMd3Tiebreak("nope")).toBeUndefined();
    expect(parseMd3Tiebreak({ tb: { exact: 1 } })).toBeUndefined();
    expect(parseMd3Tiebreak({ tb: { exact: "x", gd: 1, result: 1, goalDelta: 1 } })).toBeUndefined();
  });
});
