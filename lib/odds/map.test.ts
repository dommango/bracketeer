import { describe, it, expect } from "vitest";
import {
  toImpliedProbs,
  toTwoWayProbs,
  toOutrightProbs,
  normalizeTeam,
  resolveMatchNo,
  liveUpset,
} from "./map";

describe("toImpliedProbs", () => {
  it("normalizes to sum 1 and strips overround", () => {
    const p = toImpliedProbs(2.0, 3.5, 4.0); // raw 0.5+0.286+0.25 = 1.036
    const sum = p.homeWinProb + p.drawProb + p.awayWinProb;
    expect(sum).toBeCloseTo(1, 5);
    expect(p.homeWinProb).toBeGreaterThan(p.awayWinProb);
  });
});

describe("toTwoWayProbs", () => {
  it("normalizes Over/Under to sum 1 and strips overround", () => {
    const p = toTwoWayProbs(1.9, 1.9); // symmetric → 50/50
    expect(p.overProb + p.underProb).toBeCloseTo(1, 5);
    expect(p.overProb).toBeCloseTo(0.5, 5);
  });
  it("favors the shorter price", () => {
    const p = toTwoWayProbs(1.5, 2.6); // Over cheaper → more likely
    expect(p.overProb).toBeGreaterThan(p.underProb);
  });
  it("returns 0/0 for bad prices instead of NaN/Infinity", () => {
    expect(toTwoWayProbs(0, 1.9)).toEqual({ overProb: 0, underProb: 0 });
    expect(toTwoWayProbs(NaN, 1.9)).toEqual({ overProb: 0, underProb: 0 });
  });
});

describe("toOutrightProbs", () => {
  it("normalizes the field to sum 1 and drops unknown names", () => {
    const probs = toOutrightProbs([
      { teamName: "Brazil", decimal: 5 },
      { teamName: "Mexico", decimal: 10 },
      { teamName: "Atlantis", decimal: 4 }, // unknown → dropped
    ]);
    expect(probs.map((p) => p.teamCode).sort()).toEqual(["BRA", "MEX"]);
    const sum = probs.reduce((s, p) => s + p.winProb, 0);
    expect(sum).toBeCloseTo(1, 5);
    const bra = probs.find((p) => p.teamCode === "BRA")!;
    const mex = probs.find((p) => p.teamCode === "MEX")!;
    expect(bra.winProb).toBeGreaterThan(mex.winProb); // shorter price → higher prob
  });
  it("returns empty when nothing resolves", () => {
    expect(toOutrightProbs([{ teamName: "Atlantis", decimal: 3 }])).toEqual([]);
  });
});

describe("normalizeTeam", () => {
  it("resolves canonical names and aliases", () => {
    expect(normalizeTeam("Mexico")).toBe("MEX");
    expect(normalizeTeam("South Korea")).toBe("KOR");
    expect(normalizeTeam("United States")).toBe("USA");
    expect(normalizeTeam("Ivory Coast")).toBe("CIV");
    expect(normalizeTeam("Czech Republic")).toBe("CZE");
    expect(normalizeTeam("Turkey")).toBe("TUR");
  });
  it("returns null for unknown", () => {
    expect(normalizeTeam("Atlantis")).toBeNull();
  });
});

describe("resolveMatchNo", () => {
  const matches = [
    { matchNo: 1, homeCode: "MEX", awayCode: "BRA" },
    { matchNo: 2, homeCode: "USA", awayCode: "ENG" },
  ];
  it("matches the unordered code pair", () => {
    expect(resolveMatchNo("BRA", "MEX", matches)).toBe(1);
    expect(resolveMatchNo("USA", "ENG", matches)).toBe(2);
  });
  it("returns null when no pair matches", () => {
    expect(resolveMatchNo("MEX", "USA", matches)).toBeNull();
  });
});

describe("liveUpset", () => {
  const probs = { homeWinProb: 0.7, drawProb: 0.2, awayWinProb: 0.1 }; // home favored
  it("true when LIVE and the underdog leads", () => {
    expect(liveUpset({ status: "LIVE", homeScore: 0, awayScore: 1 }, probs)).toBe(true);
  });
  it("false when the favorite leads", () => {
    expect(liveUpset({ status: "LIVE", homeScore: 1, awayScore: 0 }, probs)).toBe(false);
  });
  it("false when tied or not live", () => {
    expect(liveUpset({ status: "LIVE", homeScore: 1, awayScore: 1 }, probs)).toBe(false);
    expect(liveUpset({ status: "FINAL", homeScore: 0, awayScore: 1 }, probs)).toBe(false);
  });
});
