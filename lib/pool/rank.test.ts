import { describe, it, expect } from "vitest";
import { assignRanks } from "./rank";

describe("assignRanks", () => {
  it("numbers distinct totals sequentially", () => {
    const ranked = assignRanks([
      { id: "a", total: 30 },
      { id: "b", total: 20 },
      { id: "c", total: 10 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("gives tied totals the same rank (standard competition '1224')", () => {
    const ranked = assignRanks([
      { id: "a", total: 30 },
      { id: "b", total: 20 },
      { id: "c", total: 20 },
      { id: "d", total: 10 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("handles a tie at the top", () => {
    const ranked = assignRanks([
      { id: "a", total: 50 },
      { id: "b", total: 50 },
      { id: "c", total: 40 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("handles a three-way tie followed by another entry", () => {
    const ranked = assignRanks([
      { id: "a", total: 12 },
      { id: "b", total: 12 },
      { id: "c", total: 12 },
      { id: "d", total: 5 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 1, 4]);
  });

  it("preserves the input order and other fields", () => {
    const ranked = assignRanks([
      { id: "a", label: "Zoe", total: 20 },
      { id: "b", label: "Amy", total: 20 },
    ]);
    expect(ranked).toEqual([
      { id: "a", label: "Zoe", total: 20, rank: 1 },
      { id: "b", label: "Amy", total: 20, rank: 1 },
    ]);
  });

  it("returns an empty array unchanged", () => {
    expect(assignRanks([])).toEqual([]);
  });

  it("ranks by a custom value (live total = total + projected), ties shared", () => {
    // Input must be pre-sorted by the same value. b and c tie on live total 40.
    const ranked = assignRanks(
      [
        { id: "a", total: 30, projected: 15 }, // 45
        { id: "b", total: 40, projected: 0 }, // 40
        { id: "c", total: 25, projected: 15 }, // 40
        { id: "d", total: 20, projected: 0 }, // 20
      ],
      (r) => r.total + r.projected,
    );
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });
});
