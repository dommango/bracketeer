import { describe, it, expect } from "vitest";
import { buildConsensus, type ConsensusInput } from "./consensus";

const base: ConsensusInput = {
  homeCode: "BRA",
  awayCode: "KOR",
  homeName: "Brazil",
  awayName: "South Korea",
  modelHomePct: 62,
  modelAwayPct: 20,
  poolHomePct: 81,
  poolAwayPct: 19,
  poolOtherPct: 0,
};

describe("buildConsensus", () => {
  it("agrees when model and pool both favor the same team", () => {
    const c = buildConsensus(base)!;
    expect(c.agree).toBe(true);
    expect(c.modelFavorite.code).toBe("BRA");
    expect(c.poolFavorite.code).toBe("BRA");
    expect(c.modelFavorite.modelPct).toBe(62);
    expect(c.modelFavorite.poolPct).toBe(81);
    // pool backs the favorite 19pts harder than the model.
    expect(c.gap).toBe(19);
  });

  it("flags divergence when the pool leans the model's underdog", () => {
    const c = buildConsensus({ ...base, poolHomePct: 40, poolAwayPct: 60 })!;
    expect(c.agree).toBe(false);
    expect(c.modelFavorite.code).toBe("BRA");
    expect(c.poolFavorite.code).toBe("KOR");
    expect(c.gap).toBe(40 - 62); // -22, pool cooler on the model's pick
  });

  it("resolves model and pool ties to the home side deterministically", () => {
    const c = buildConsensus({
      ...base,
      modelHomePct: 40,
      modelAwayPct: 40,
      poolHomePct: 50,
      poolAwayPct: 50,
    })!;
    expect(c.modelFavorite.code).toBe("BRA");
    expect(c.poolFavorite.code).toBe("BRA");
    expect(c.agree).toBe(true);
  });

  it("flags a divided pool when 'other' is the plurality", () => {
    // Most entries bracketed neither real team into this slot (early-round divergence).
    const c = buildConsensus({ ...base, poolHomePct: 10, poolAwayPct: 5, poolOtherPct: 85 })!;
    expect(c.poolDivided).toBe(true);
    expect(c.poolOtherPct).toBe(85);
    // poolFavorite still resolves among the two real teams for callers that want it.
    expect(c.poolFavorite.code).toBe("BRA");
  });

  it("does not flag a divided pool when a real team holds the plurality", () => {
    const c = buildConsensus({ ...base, poolHomePct: 60, poolAwayPct: 10, poolOtherPct: 30 })!;
    expect(c.poolDivided).toBe(false);
  });

  it("treats an all-'other' pool as divided rather than a 0% lean", () => {
    const c = buildConsensus({ ...base, poolHomePct: 0, poolAwayPct: 0, poolOtherPct: 100 })!;
    expect(c.poolDivided).toBe(true);
  });

  it("returns null when a team is unresolved", () => {
    expect(buildConsensus({ ...base, homeCode: null })).toBeNull();
    expect(buildConsensus({ ...base, awayCode: null })).toBeNull();
  });

  it("returns null when the model has no win percentages", () => {
    expect(buildConsensus({ ...base, modelHomePct: null })).toBeNull();
    expect(buildConsensus({ ...base, modelAwayPct: null })).toBeNull();
  });

  it("treats a zero model percentage as present, not absent", () => {
    const c = buildConsensus({ ...base, modelAwayPct: 0 })!;
    expect(c).not.toBeNull();
    expect(c.away.modelPct).toBe(0);
  });

  it("never mutates its input", () => {
    const input = { ...base };
    const snapshot = JSON.stringify(input);
    buildConsensus(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
