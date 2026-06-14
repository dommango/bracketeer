import { describe, it, expect } from "vitest";
import { matchTag, roundOf, isScoredKnockout } from "./rounds";

describe("matchTag", () => {
  it("labels each knockout match by round + index", () => {
    expect(matchTag(73)).toBe("R32-1");
    expect(matchTag(88)).toBe("R32-16");
    expect(matchTag(89)).toBe("R16-1");
    expect(matchTag(96)).toBe("R16-8");
    expect(matchTag(97)).toBe("QF1");
    expect(matchTag(100)).toBe("QF4");
    expect(matchTag(101)).toBe("SF1");
    expect(matchTag(102)).toBe("SF2");
    expect(matchTag(103)).toBe("3rd Place");
    expect(matchTag(104)).toBe("Final");
  });
  it("returns empty for group matches", () => {
    expect(matchTag(1)).toBe("");
    expect(matchTag(72)).toBe("");
  });
});

describe("roundOf", () => {
  it("maps match numbers to their round", () => {
    expect(roundOf(1)).toBe("GROUP");
    expect(roundOf(73)).toBe("R32");
    expect(roundOf(104)).toBe("FINAL");
  });
});

describe("isScoredKnockout", () => {
  it("excludes the bronze final (103) and group matches", () => {
    expect(isScoredKnockout(73)).toBe(true);
    expect(isScoredKnockout(104)).toBe(true);
    expect(isScoredKnockout(103)).toBe(false);
    expect(isScoredKnockout(72)).toBe(false);
  });
});
