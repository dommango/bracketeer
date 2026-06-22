import { describe, it, expect } from "vitest";
import { rankEnteredRows } from "./rank-entered";
import type { LeaderboardRow } from "@/lib/pool/scoring";

function row(p: Partial<LeaderboardRow> & { entryId: string }): LeaderboardRow {
  return {
    rank: 0,
    entryId: p.entryId,
    label: p.label ?? p.entryId,
    userId: p.userId ?? null,
    total: p.total ?? 0,
    breakdown: p.breakdown ?? null,
    tiebreak: p.tiebreak ?? null,
    projected: p.projected,
  };
}

describe("rankEnteredRows", () => {
  it("drops entries not opted in", () => {
    const rows = [
      row({ entryId: "a", total: 10 }),
      row({ entryId: "b", total: 8 }),
      row({ entryId: "c", total: 6 }),
    ];
    const out = rankEnteredRows(rows, new Set(["a", "c"]));
    expect(out.map((r) => r.entryId)).toEqual(["a", "c"]);
  });

  it("re-ranks from 1 after filtering out private entries (no gaps)", () => {
    // b is private and would have sat at rank 2 in the full pool; removing it
    // must not leave a hole — c should become rank 2, not stay at 3.
    const rows = [
      row({ entryId: "a", total: 10 }),
      row({ entryId: "b", total: 8 }),
      row({ entryId: "c", total: 6 }),
    ];
    const out = rankEnteredRows(rows, new Set(["a", "c"]));
    expect(out.map((r) => [r.entryId, r.rank])).toEqual([
      ["a", 1],
      ["c", 2],
    ]);
  });

  it("ranks by live total (official + projected), not official alone", () => {
    const rows = [
      row({ entryId: "a", total: 10 }),
      row({ entryId: "b", total: 7, projected: 5 }), // live 12 — should lead
    ];
    const out = rankEnteredRows(rows, new Set(["a", "b"]));
    expect(out.map((r) => r.entryId)).toEqual(["b", "a"]);
    expect(out[0].rank).toBe(1);
  });

  it("ties share a rank (competition ranking), label orders display", () => {
    const rows = [
      row({ entryId: "x", label: "Zoe", total: 5 }),
      row({ entryId: "y", label: "Ann", total: 5 }),
      row({ entryId: "z", label: "Bob", total: 3 }),
    ];
    const out = rankEnteredRows(rows, new Set(["x", "y", "z"]));
    expect(out.map((r) => [r.label, r.rank])).toEqual([
      ["Ann", 1],
      ["Zoe", 1],
      ["Bob", 3],
    ]);
  });

  it("returns empty when nothing is entered", () => {
    const rows = [row({ entryId: "a", total: 10 })];
    expect(rankEnteredRows(rows, new Set())).toEqual([]);
  });
});
