import { describe, it, expect } from "vitest";
import { buildBracketView } from "./bracket-view";
import { GROUPS, TEAMS, R32 } from "@/lib/scoring/data";
import { emptyPicks, type Results } from "@/lib/scoring/types";
import type { GroupResultRow } from "./group-table";

const groups = Object.keys(GROUPS);

function chalk(): Results {
  return {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
    awards: { player: "Messi", young: "Yamal", boot: "Kane", goal: "" },
    finalGoals: null,
  };
}

describe("buildBracketView", () => {
  it("produces the six knockout rounds with the right match counts", () => {
    const view = buildBracketView(chalk());
    expect(view.rounds.map((r) => r.matches.length)).toEqual([16, 8, 4, 2, 1, 1]);
    expect(view.rounds.map((r) => r.label)).toContain("Final");
  });

  it("labels group standings with full team names", () => {
    const view = buildBracketView(chalk());
    const groupA = view.groups.find((g) => g.group === "A")!;
    expect(groupA.first).toBe(TEAMS[GROUPS.A[0]]);
    expect(groupA.second).toBe(TEAMS[GROUPS.A[1]]);
  });

  it("shows feeder slot labels for unresolved slots and surfaces scores", () => {
    const view = buildBracketView(chalk(), new Map([[73, { homeScore: 2, awayScore: 1 }]]));
    const r32 = view.rounds[0].matches.find((m) => m.matchNo === 73)!;
    // R32 teams resolve from standings; the score is attached.
    expect(r32.homeScore).toBe(2);
    expect(r32.away).not.toBe("");
    // A later round with no feeders resolved shows the feeder labels, not "TBD".
    const final = view.rounds[5].matches[0];
    expect(final.home).toBe("SF1");
    expect(final.away).toBe("SF2");
  });

  it("keeps R32 home/away aligned with the resolver", () => {
    const view = buildBracketView(chalk());
    // Group A runner-up is the home side of match 73 ({pos:2, group:A}).
    const m73 = view.rounds[0].matches.find((m) => m.matchNo === R32[0].id)!;
    expect(m73.homeCode).toBe(GROUPS.A[1]);
  });
});

const results = (over: Partial<Results> = {}): Results => ({
  ...emptyPicks(),
  finalGoals: null,
  ...over,
});

describe("buildBracketView group tables", () => {
  it("prepopulates a full 4-team table (non-provisional) when no group rows are given", () => {
    const view = buildBracketView(results());
    const a = view.groups.find((g) => g.group === "A")!;
    // Tables are always seeded (all 4 teams at 0) so every group renders same-size.
    expect(a.table).toHaveLength(4);
    expect(a.table.every((r) => r.played === 0)).toBe(true);
    expect(a.provisional).toBe(false);
  });

  it("fills provisional 1st/2nd from the live table when the group is not official", () => {
    // Group A = MEX, RSA, KOR, CZE. MEX wins, RSA second.
    const rows: GroupResultRow[] = [
      { homeCode: "MEX", awayCode: "KOR", homeScore: 2, awayScore: 0 },
      { homeCode: "RSA", awayCode: "CZE", homeScore: 1, awayScore: 0 },
    ];
    const view = buildBracketView(results(), new Map(), rows);
    const a = view.groups.find((g) => g.group === "A")!;
    expect(a.provisional).toBe(true);
    expect(a.first).toBe("Mexico");
    expect(a.table.length).toBe(4);
    expect(a.table[0].code).toBe("MEX");
  });

  it("prefers the official result over the live table", () => {
    const rows: GroupResultRow[] = [
      { homeCode: "MEX", awayCode: "KOR", homeScore: 2, awayScore: 0 },
    ];
    const view = buildBracketView(results({ groupFirst: { A: "KOR" } }), new Map(), rows);
    const a = view.groups.find((g) => g.group === "A")!;
    expect(a.provisional).toBe(false);
    expect(a.first).toBe("Korea Republic");
  });
});
