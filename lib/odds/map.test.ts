import { describe, it, expect } from "vitest";
import { toImpliedProbs, normalizeTeam, resolveMatchNo, liveUpset } from "./map";

describe("toImpliedProbs", () => {
  it("normalizes to sum 1 and strips overround", () => {
    const p = toImpliedProbs(2.0, 3.5, 4.0); // raw 0.5+0.286+0.25 = 1.036
    const sum = p.homeWinProb + p.drawProb + p.awayWinProb;
    expect(sum).toBeCloseTo(1, 5);
    expect(p.homeWinProb).toBeGreaterThan(p.awayWinProb);
  });
});

describe("normalizeTeam", () => {
  it("resolves canonical names and aliases", () => {
    expect(normalizeTeam("Mexico")).toBe("MEX");
    expect(normalizeTeam("South Korea")).toBe("KOR");
    expect(normalizeTeam("United States")).toBe("USA");
    expect(normalizeTeam("Ivory Coast")).toBe("CIV");
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
