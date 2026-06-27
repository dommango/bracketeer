import { describe, it, expect } from "vitest";
import { md3CountLine } from "./md3-summary";

describe("md3CountLine", () => {
  it("shows all open for a fresh entrant", () => {
    expect(md3CountLine({ pickedCount: 0, openCount: 24, missedCount: 0 })).toBe("24 open");
  });

  it("joins predicted and open with no missed", () => {
    expect(md3CountLine({ pickedCount: 12, openCount: 12, missedCount: 0 })).toBe(
      "12 predicted · 12 open",
    );
  });

  it("surfaces the missed bucket for a late joiner", () => {
    expect(md3CountLine({ pickedCount: 12, openCount: 8, missedCount: 4 })).toBe(
      "12 predicted · 8 open · 4 missed",
    );
  });

  it("drops the open clause once every fixture is locked", () => {
    expect(md3CountLine({ pickedCount: 20, openCount: 0, missedCount: 4 })).toBe(
      "20 predicted · 4 missed",
    );
  });

  it("shows just predicted when all picks are in and nothing is missed", () => {
    expect(md3CountLine({ pickedCount: 24, openCount: 0, missedCount: 0 })).toBe("24 predicted");
  });

  it("falls back to a neutral zero state when there are no fixtures", () => {
    expect(md3CountLine({ pickedCount: 0, openCount: 0, missedCount: 0 })).toBe("0 open");
  });
});
