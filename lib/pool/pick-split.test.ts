import { describe, it, expect } from "vitest";
import { buildPickSplit } from "./pick-split";

describe("buildPickSplit", () => {
  it("counts home/away/other and computes whole-percent shares", () => {
    const split = buildPickSplit("MEX", "CAN", ["MEX", "MEX", "CAN", "BRA"]);
    expect(split.total).toBe(4);
    expect(split.home).toMatchObject({ code: "MEX", name: "Mexico", count: 2, pct: 50 });
    expect(split.away).toMatchObject({ code: "CAN", name: "Canada", count: 1, pct: 25 });
    expect(split.other).toMatchObject({ code: null, name: "Other", count: 1, pct: 25 });
  });

  it("ignores absent picks in the total", () => {
    const split = buildPickSplit("MEX", "CAN", ["MEX", undefined, null, "CAN"]);
    expect(split.total).toBe(2);
    expect(split.home.count).toBe(1);
    expect(split.away.count).toBe(1);
  });

  it("returns zero shares when nobody has picked", () => {
    const split = buildPickSplit("MEX", "CAN", []);
    expect(split.total).toBe(0);
    expect(split.home.pct).toBe(0);
    expect(split.away.pct).toBe(0);
    expect(split.other.pct).toBe(0);
  });

  it("labels TBD teams when a side is unresolved", () => {
    const split = buildPickSplit(null, null, ["MEX"]);
    expect(split.home.name).toBe("TBD");
    expect(split.other.count).toBe(1); // pick lands in "other" with no known side
  });
});
