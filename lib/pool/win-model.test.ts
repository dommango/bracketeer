import { describe, it, expect } from "vitest";
import { buildWinModel, knockoutDepth, type R32MatchInput, type WinModelInput } from "./win-model";

// A usable R32 match: homeWinProb/draw/away sum to 1. Two-way home prob is
// homeWinProb / (homeWinProb + awayWinProb).
const match = (
  matchId: number,
  homeCode: string,
  awayCode: string,
  probs: [number, number, number],
): R32MatchInput => ({
  matchId,
  homeCode,
  awayCode,
  homeWinProb: probs[0],
  drawProb: probs[1],
  awayWinProb: probs[2],
});

const build = (over: Partial<WinModelInput>): ReturnType<typeof buildWinModel> =>
  buildWinModel({ r32: [], outrights: {}, decided: {}, ...over });

describe("knockoutDepth", () => {
  it("maps each knockout round to its rounds-past-R32 depth", () => {
    expect(knockoutDepth(73)).toBe(0);
    expect(knockoutDepth(88)).toBe(0);
    expect(knockoutDepth(89)).toBe(1);
    expect(knockoutDepth(97)).toBe(2);
    expect(knockoutDepth(101)).toBe(3);
    expect(knockoutDepth(104)).toBe(4);
  });

  it("excludes group matches and the unscored bronze final", () => {
    expect(knockoutDepth(72)).toBeNull();
    expect(knockoutDepth(103)).toBeNull();
    expect(knockoutDepth(105)).toBeNull();
  });
});

describe("buildWinModel — R32 round", () => {
  it("normalizes match odds to a two-way win probability (draw removed)", () => {
    const model = build({ r32: [match(73, "AAA", "BBB", [0.5, 0.2, 0.3])] });
    // two-way home = 0.5 / (0.5 + 0.3) = 0.625
    expect(model.advance[73]["AAA"]).toBeCloseTo(0.625, 6);
    expect(model.advance[73]["BBB"]).toBeCloseTo(0.375, 6);
  });

  it("ignores odds that don't sum to ~1 (no usable signal from that match)", () => {
    const model = build({ r32: [match(73, "AAA", "BBB", [0.5, 0.2, 0.9])] });
    expect(model.advance[73]).toEqual({});
    expect(model.hasData).toBe(false);
  });

  it("reports hasData=false when no team has any signal", () => {
    expect(build({}).hasData).toBe(false);
  });
});

describe("buildWinModel — geometric reconciliation", () => {
  it("reproduces the champion outright as the probability of advancing out of the Final", () => {
    const model = build({
      r32: [match(73, "AAA", "BBB", [0.5, 0.2, 0.3])],
      outrights: { AAA: 0.1, BBB: 0.02 },
    });
    // By construction w·g⁴ = c, so advancing out of match 104 == the outright.
    expect(model.advance[104]["AAA"]).toBeCloseTo(0.1, 6);
    expect(model.advance[104]["BBB"]).toBeCloseTo(0.02, 6);
  });

  it("decays monotonically round by round along a team's path (73→90→97→101→104)", () => {
    const model = build({
      r32: [match(73, "AAA", "BBB", [0.5, 0.2, 0.3])],
      outrights: { AAA: 0.1 },
    });
    const a73 = model.advance[73]["AAA"];
    const a90 = model.advance[90]["AAA"];
    const a97 = model.advance[97]["AAA"];
    const a101 = model.advance[101]["AAA"];
    const a104 = model.advance[104]["AAA"];
    expect(a73).toBeGreaterThan(a90);
    expect(a90).toBeGreaterThan(a97);
    expect(a97).toBeGreaterThan(a101);
    expect(a101).toBeGreaterThan(a104);
    expect(a104).toBeCloseTo(0.1, 6);
  });
});

describe("buildWinModel — fallbacks", () => {
  it("uses the R32 win probability as the per-round constant when no outright exists", () => {
    const model = build({ r32: [match(73, "AAA", "BBB", [0.5, 0.2, 0.3])] });
    const w = 0.625; // g == w in this fallback
    expect(model.advance[73]["AAA"]).toBeCloseTo(w, 6);
    expect(model.advance[90]["AAA"]).toBeCloseTo(w * w, 6);
  });

  it("derives a per-round probability from the outright alone when no R32 odds exist", () => {
    // No usable R32 odds → q = c^(1/5) per round; advancing out of R32 (depth 0) is q.
    const model = build({ outrights: { AAA: 0.032 } });
    // Without R32 participants there's no match 73 entry, but the team still has a model;
    // verify via a match where AAA appears. Provide AAA as an R32 participant w/o odds.
    const model2 = build({
      r32: [{ matchId: 73, homeCode: "AAA", awayCode: "BBB", homeWinProb: null, drawProb: null, awayWinProb: null }],
      outrights: { AAA: 0.032 },
    });
    const q = Math.pow(0.032, 0.2); // 0.5
    expect(model2.advance[73]["AAA"]).toBeCloseTo(q, 6);
    expect(model.hasData).toBe(true);
  });
});

describe("buildWinModel — conditioning on decided results", () => {
  it("collapses a decided match to its actual winner with probability 1", () => {
    const model = build({
      r32: [match(73, "AAA", "BBB", [0.5, 0.2, 0.3])],
      outrights: { AAA: 0.1, BBB: 0.02 },
      decided: { 73: "AAA" },
    });
    expect(model.advance[73]).toEqual({ AAA: 1 });
  });

  it("drops the eliminated team out of every deeper round", () => {
    const model = build({
      r32: [match(73, "AAA", "BBB", [0.5, 0.2, 0.3])],
      outrights: { AAA: 0.1, BBB: 0.02 },
      decided: { 73: "AAA" },
    });
    // BBB lost in the R32, so it cannot appear when match 73 feeds R16 match 90.
    expect(model.advance[90]["BBB"]).toBeUndefined();
    // AAA advanced for certain, so its R16 advance is just g (P(reach)=1 × g).
    expect(model.advance[90]["AAA"]).toBeGreaterThan(0);
  });

  it("keeps a decided, unpriced advancer in later rounds at a neutral per-round chance", () => {
    // AAA won its R32 match but has no odds and no outright (no market signal).
    const model = build({
      r32: [{ matchId: 73, homeCode: "AAA", awayCode: "BBB", homeWinProb: null, drawProb: null, awayWinProb: null }],
      decided: { 73: "AAA" },
    });
    expect(model.advance[73]).toEqual({ AAA: 1 });
    // Without the fallback AAA would vanish at R16; instead it carries a coin-flip
    // chance (P(reach)=1 × 0.5), so picking AAA to win match 90 still earns EV.
    expect(model.advance[90]["AAA"]).toBeCloseTo(0.5, 6);
    expect(model.advance[97]["AAA"]).toBeCloseTo(0.25, 6);
  });
});
