import { describe, it, expect } from "vitest";
import { PRIZES, computePrizeAmount } from "./prizes-config";
import { formatPrize } from "./format-prize";

describe("computePrizeAmount", () => {
  it("returns the flat amount for a fixed prize regardless of entrants", () => {
    expect(computePrizeAmount(PRIZES.MATCH_DAY_3_PICKEM, 0)).toBe(50);
    expect(computePrizeAmount(PRIZES.MATCH_DAY_3_PICKEM, 1)).toBe(50);
    expect(computePrizeAmount(PRIZES.MATCH_DAY_3_PICKEM, 999)).toBe(50);
  });

  it("scales the knockout prize $1/entrant with a $50 floor and $250 cap", () => {
    const ko = PRIZES.KNOCKOUT;
    expect(computePrizeAmount(ko, 0)).toBe(50); // floor
    expect(computePrizeAmount(ko, 25)).toBe(50); // below floor → floor
    expect(computePrizeAmount(ko, 50)).toBe(50); // exactly floor
    expect(computePrizeAmount(ko, 75)).toBe(75); // linear region
    expect(computePrizeAmount(ko, 100)).toBe(100); // owner's anchor point
    expect(computePrizeAmount(ko, 250)).toBe(250); // exactly cap
    expect(computePrizeAmount(ko, 400)).toBe(250); // above cap → cap
  });

  it("never returns a negative amount for a nonsensical entrant count", () => {
    expect(computePrizeAmount(PRIZES.KNOCKOUT, -10)).toBe(50);
  });
});

describe("formatPrize", () => {
  it("renders known currencies with their symbol", () => {
    expect(formatPrize(50, "USD")).toBe("$50");
    expect(formatPrize(100, "GBP")).toBe("£100");
    expect(formatPrize(250, "EUR")).toBe("€250");
  });

  it("is case-insensitive on the currency code", () => {
    expect(formatPrize(50, "usd")).toBe("$50");
  });

  it("falls back to '<amount> <CODE>' for unknown currencies", () => {
    expect(formatPrize(50, "CAD")).toBe("50 CAD");
  });
});
