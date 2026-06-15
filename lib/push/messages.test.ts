import { describe, it, expect } from "vitest";
import { knockoutRoundLabel, knockoutResultPush } from "./messages";

describe("knockoutRoundLabel", () => {
  it("maps each match-number range to its round", () => {
    expect(knockoutRoundLabel(73)).toBe("Round of 32");
    expect(knockoutRoundLabel(88)).toBe("Round of 32");
    expect(knockoutRoundLabel(89)).toBe("Round of 16");
    expect(knockoutRoundLabel(96)).toBe("Round of 16");
    expect(knockoutRoundLabel(97)).toBe("Quarter-final");
    expect(knockoutRoundLabel(100)).toBe("Quarter-final");
    expect(knockoutRoundLabel(101)).toBe("Semi-final");
    expect(knockoutRoundLabel(102)).toBe("Semi-final");
    expect(knockoutRoundLabel(103)).toBe("Third-place play-off");
    expect(knockoutRoundLabel(104)).toBe("Final");
  });

  it("falls back to a generic label outside the knockout range", () => {
    expect(knockoutRoundLabel(1)).toBe("Knockout");
    expect(knockoutRoundLabel(72)).toBe("Knockout");
  });
});

describe("knockoutResultPush", () => {
  it("uses champion copy for the final and names the winner", () => {
    const copy = knockoutResultPush(104, "Brazil");
    expect(copy.title).toContain("champion");
    expect(copy.body).toContain("Brazil");
  });

  it("uses the round label and winner for non-final rounds", () => {
    const copy = knockoutResultPush(89, "Argentina");
    expect(copy.title).toContain("Round of 16");
    expect(copy.body).toContain("Argentina");
    expect(copy.body).toContain("advance");
  });
});
