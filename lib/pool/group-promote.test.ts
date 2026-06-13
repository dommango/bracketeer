import { describe, it, expect } from "vitest";
import { promoteCompletedGroups } from "./group-promote";
import { GROUPS } from "@/lib/scoring/data";
import type { GroupResultRow } from "./group-table";

// Build all six FINAL results for one group, ordered so `order` is the finishing
// table (each stronger team beats every weaker team). The 3rd-place team beats
// the 4th by `thirdMargin`, varying its goal difference so cross-group thirds can
// be sorted into a best-8 cut.
function completeGroup(order: readonly string[], thirdMargin = 1): GroupResultRow[] {
  const rows: GroupResultRow[] = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const margin = a === 2 && b === 3 ? thirdMargin : 1;
      rows.push({ homeCode: order[a], awayCode: order[b], homeScore: margin, awayScore: 0 });
    }
  }
  return rows;
}

describe("promoteCompletedGroups", () => {
  it("promotes determinate 1st/2nd for a completed group; thirds wait", () => {
    // Group A = MEX, RSA, KOR, CZE in seed order; finish them in that order.
    const promoted = promoteCompletedGroups(completeGroup(GROUPS.A));
    expect(promoted.groupFirst).toEqual({ A: "MEX" });
    expect(promoted.groupSecond).toEqual({ A: "RSA" });
    // Only one group complete → the best-8-of-12 thirds cannot be settled yet.
    expect(promoted.thirdAdvance).toEqual([]);
  });

  it("promotes nothing for a group still in progress", () => {
    // Only two of Group A's six matches are final.
    const rows: GroupResultRow[] = [
      { homeCode: "MEX", awayCode: "RSA", homeScore: 2, awayScore: 0 },
      { homeCode: "MEX", awayCode: "KOR", homeScore: 1, awayScore: 0 },
    ];
    const promoted = promoteCompletedGroups(rows);
    expect(promoted.groupFirst).toEqual({});
    expect(promoted.groupSecond).toEqual({});
    expect(promoted.thirdAdvance).toEqual([]);
  });

  it("leaves a tied top of a completed group unpromoted", () => {
    // MEX and RSA both beat KOR & CZE by the same scores and draw each other →
    // genuinely tied for 1st/2nd, so neither position is promoted.
    const rows: GroupResultRow[] = [
      { homeCode: "MEX", awayCode: "RSA", homeScore: 1, awayScore: 1 },
      { homeCode: "MEX", awayCode: "KOR", homeScore: 2, awayScore: 0 },
      { homeCode: "MEX", awayCode: "CZE", homeScore: 2, awayScore: 0 },
      { homeCode: "RSA", awayCode: "KOR", homeScore: 2, awayScore: 0 },
      { homeCode: "RSA", awayCode: "CZE", homeScore: 2, awayScore: 0 },
      { homeCode: "KOR", awayCode: "CZE", homeScore: 1, awayScore: 0 },
    ];
    const promoted = promoteCompletedGroups(rows);
    expect(promoted.groupFirst.A).toBeUndefined();
    expect(promoted.groupSecond.A).toBeUndefined();
  });

  it("settles the best-8 thirds once every group is complete", () => {
    const letters = Object.keys(GROUPS);
    const rows = letters.flatMap((g, i) => completeGroup(GROUPS[g], i + 1));
    const promoted = promoteCompletedGroups(rows);
    expect(Object.keys(promoted.groupFirst)).toHaveLength(12);
    expect(Object.keys(promoted.groupSecond)).toHaveLength(12);
    expect(promoted.thirdAdvance).toHaveLength(8);
    // The eight with the largest third-place goal difference (groups E–L, whose
    // third margins were 5–12) advance; A–D's thirds are cut.
    expect(promoted.thirdAdvance).toContain(GROUPS.L[2]);
    expect(promoted.thirdAdvance).not.toContain(GROUPS.A[2]);
  });
});
