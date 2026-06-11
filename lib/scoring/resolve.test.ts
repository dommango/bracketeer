import { describe, it, expect } from "vitest";
import { resolveR32Slots } from "./resolve";
import { GROUPS, R32 } from "./data";
import { emptyPicks, type GroupLetter, type Picks } from "./types";

const groups = Object.keys(GROUPS) as GroupLetter[];

// All eight R32 third-place slots sit on the "b" side of these matches.
const THIRD_SLOT_MATCHES = [74, 77, 79, 80, 81, 82, 85, 87];

function picksWithThirds(thirdGroups: GroupLetter[]): Picks {
  return {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: thirdGroups.map((g) => GROUPS[g][2]),
  };
}

function thirdSlotAssignments(picks: Picks): Record<number, string | null> {
  const resolved = resolveR32Slots(picks);
  return Object.fromEntries(THIRD_SLOT_MATCHES.map((id) => [id, resolved[id].b]));
}

describe("resolveR32Slots third-place assignment", () => {
  it("seats all 8 thirds when an assignment exists that greedy first-fit misses", () => {
    // Groups A–H in order: greedy consumes A/E/H before reaching match 82
    // (eligible groups A,E,H,I,J) and strands a team; backtracking seats all 8.
    const picks = picksWithThirds(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const byMatch = thirdSlotAssignments(picks);

    expect(byMatch).toEqual({
      74: GROUPS.A[2],
      77: GROUPS.C[2],
      79: GROUPS.F[2],
      80: GROUPS.E[2],
      81: GROUPS.B[2],
      82: GROUPS.H[2],
      85: GROUPS.G[2],
      87: GROUPS.D[2],
    });

    const seated = Object.values(byMatch);
    expect(new Set(seated).size).toBe(8);
    expect(seated).not.toContain(null);
  });

  it("each picked third appears in exactly one slot whose group list allows it", () => {
    const picks = picksWithThirds(["C", "D", "E", "F", "H", "I", "J", "L"]);
    const byMatch = thirdSlotAssignments(picks);

    const teamGroup: Record<string, GroupLetter> = {};
    for (const g of groups) for (const t of GROUPS[g]) teamGroup[t] = g;

    const seated = Object.values(byMatch).filter(Boolean) as string[];
    expect(new Set(seated).size).toBe(8);
    for (const m of R32) {
      if (!("third" in m.b)) continue;
      const team = byMatch[m.id];
      expect(team).toBeTruthy();
      expect(m.b.third).toContain(teamGroup[team as string]);
    }
  });

  it("falls back to first-eligible per slot when fewer than 8 thirds are picked", () => {
    // Mirrors the revised tool: with no full assignment possible, each third
    // slot independently shows the first eligible team from the full list.
    const picks = picksWithThirds(["A", "B"]);
    const resolved = resolveR32Slots(picks);

    // Match 74 (eligible A,B,C,D,F) shows the A third; match 80 (E,H,I,J,K)
    // has no eligible pick and stays empty.
    expect(resolved[74].b).toBe(GROUPS.A[2]);
    expect(resolved[80].b).toBeNull();
  });

  it("leaves group-position slots untouched by third assignment", () => {
    const picks = picksWithThirds(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const resolved = resolveR32Slots(picks);
    for (const m of R32) {
      if ("third" in m.a) continue;
      const expected =
        m.a.pos === 1 ? picks.groupFirst[m.a.group] : picks.groupSecond[m.a.group];
      expect(resolved[m.id].a).toBe(expected);
    }
  });
});
