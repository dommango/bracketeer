import { describe, it, expect } from "vitest";
import { buildBracketView } from "./bracket-view";
import { GROUPS, TEAMS, R32 } from "@/lib/scoring/data";
import { emptyPicks, type Results } from "@/lib/scoring/types";

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

  it("shows TBD for unresolved slots and surfaces scores", () => {
    const view = buildBracketView(chalk(), new Map([[73, { homeScore: 2, awayScore: 1 }]]));
    const r32 = view.rounds[0].matches.find((m) => m.matchNo === 73)!;
    // R32 teams resolve from standings; the score is attached.
    expect(r32.homeScore).toBe(2);
    expect(r32.away).not.toBe("");
    // A later round with no feeders resolved is TBD.
    const final = view.rounds[5].matches[0];
    expect(final.home).toBe("TBD");
  });

  it("keeps R32 home/away aligned with the resolver", () => {
    const view = buildBracketView(chalk());
    // Group A runner-up is the home side of match 73 ({pos:2, group:A}).
    const m73 = view.rounds[0].matches.find((m) => m.matchNo === R32[0].id)!;
    expect(m73.homeCode).toBe(GROUPS.A[1]);
  });
});
