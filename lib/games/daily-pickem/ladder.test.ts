import { describe, it, expect } from "vitest";
import {
  KNOCKOUT_ROUND_WEIGHT,
  roundWeight,
  knockoutLadderPoints,
  ladderPointsByRound,
  perfectEligibleDays,
  perfectDayBonus,
  knockoutLadderTotal,
  PERFECT_DAY_BASE,
} from "./ladder";
import { DAILY_KNOCKOUT_MATCH_NOS } from "./scope";

describe("round weighting", () => {
  it("doubles each round: R32 1, R16 2, QF 4, SF 8, Final 16", () => {
    expect(roundWeight(73)).toBe(1); // R32
    expect(roundWeight(89)).toBe(2); // R16
    expect(roundWeight(97)).toBe(4); // QF
    expect(roundWeight(101)).toBe(8); // SF
    expect(roundWeight(104)).toBe(16); // Final
    expect(roundWeight(3)).toBe(0); // group never counts
    expect(roundWeight(103)).toBe(0); // bronze unscored
  });
});

describe("knockoutLadderPoints", () => {
  it("sums raw per-match points × round weight, ignoring group", () => {
    const perPick = { M3: 5, M73: 5, M89: 3, M97: 5, M104: 5 };
    // 5×1 + 3×2 + 5×4 + 5×16 = 5 + 6 + 20 + 80 = 111 (M3 group ignored).
    expect(knockoutLadderPoints(perPick)).toBe(111);
    expect(knockoutLadderPoints({})).toBe(0);
    expect(knockoutLadderPoints(null)).toBe(0);
  });

  it("breaks the ladder down by round", () => {
    const byRound = ladderPointsByRound({ M73: 5, M74: 1, M89: 3, M104: 5 });
    expect(byRound.R32).toBe(6); // (5+1)×1
    expect(byRound.R16).toBe(6); // 3×2
    expect(byRound.FINAL).toBe(80); // 5×16
    expect(byRound.QF).toBe(0);
  });
});

describe("perfect day", () => {
  it("only counts ≥2-match days whose every fixture is final", () => {
    const allFinal = new Set(DAILY_KNOCKOUT_MATCH_NOS);
    const days = perfectEligibleDays(allFinal);
    expect(days.length).toBeGreaterThan(0);
    // Every eligible day has ≥2 matches and belongs to a real knockout round.
    for (const d of days) {
      expect(d.matchNos.length).toBeGreaterThanOrEqual(2);
      expect(["R32", "R16", "QF", "SF", "FINAL"]).toContain(d.stage);
    }
    // No finals in → nothing eligible.
    expect(perfectEligibleDays(new Set())).toEqual([]);
  });

  it("awards a weighted sweep bonus only when every fixture of the day scored", () => {
    const day = { day: "2026-06-28", stage: "R32" as const, matchNos: [73, 74] };
    expect(perfectDayBonus({ M73: 1, M74: 5 }, [day])).toBe(PERFECT_DAY_BASE * KNOCKOUT_ROUND_WEIGHT.R32);
    expect(perfectDayBonus({ M73: 1, M74: 0 }, [day])).toBe(0); // a miss breaks it
    expect(perfectDayBonus({ M73: 1 }, [day])).toBe(0); // incomplete
    const r16Day = { day: "2026-07-04", stage: "R16" as const, matchNos: [89, 90] };
    expect(perfectDayBonus({ M89: 3, M90: 1 }, [r16Day])).toBe(PERFECT_DAY_BASE * KNOCKOUT_ROUND_WEIGHT.R16);
  });

  it("folds the sweep bonus into the ladder total", () => {
    const day = { day: "2026-06-28", stage: "R32" as const, matchNos: [73, 74] };
    // 5×1 + 1×1 = 6 weighted + a perfect-R32 bonus.
    expect(knockoutLadderTotal({ M73: 5, M74: 1 }, [day])).toBe(6 + PERFECT_DAY_BASE * 1);
  });
});
