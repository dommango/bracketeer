import { describe, it, expect } from "vitest";
import {
  resolveKnockout,
  pickFormProgress,
  validatePicks,
  scoredKnockoutNumbers,
  TARGET_GROUPS,
  TARGET_THIRDS,
  TARGET_KNOCKOUT,
} from "./pick-form";
import { GROUPS, R32 } from "@/lib/scoring/data";
import { emptyPicks } from "@/lib/scoring/types";
import type { Picks } from "@/lib/scoring/types";

// A fully-filled bracket: 1st = first listed team, 2nd = second, third = third,
// advance the first 8 groups' thirds, and pick the "a" side of every knockout.
function fullPicks(): Picks {
  const picks = emptyPicks();
  const letters = Object.keys(GROUPS);
  for (const g of letters) {
    picks.groupFirst[g] = GROUPS[g][0];
    picks.groupSecond[g] = GROUPS[g][1];
  }
  // Advance the third-listed team of the first 8 groups.
  picks.thirdAdvance = letters.slice(0, 8).map((g) => GROUPS[g][2]);

  // Resolve R32 from group picks, then pick winners cascading forward.
  const ko = resolveKnockout(picks);
  for (const slot of ko.r32) if (slot.a) picks.knockout[slot.matchNo] = slot.a.code;
  const ko2 = resolveKnockout(picks);
  for (const slot of ko2.r16) if (slot.a) picks.knockout[slot.matchNo] = slot.a.code;
  const ko3 = resolveKnockout(picks);
  for (const slot of ko3.qf) if (slot.a) picks.knockout[slot.matchNo] = slot.a.code;
  const ko4 = resolveKnockout(picks);
  for (const slot of ko4.sf) if (slot.a) picks.knockout[slot.matchNo] = slot.a.code;
  const ko5 = resolveKnockout(picks);
  if (ko5.final.a) picks.knockout[ko5.final.matchNo] = ko5.final.a.code;

  picks.awards = { player: "X", young: "Y", boot: "Z", goal: "W" };
  return picks;
}

describe("scoredKnockoutNumbers", () => {
  it("lists 31 matches, excluding bronze (103)", () => {
    const nums = scoredKnockoutNumbers();
    expect(nums).toHaveLength(31);
    expect(nums).not.toContain(103);
    expect(nums).toContain(73);
    expect(nums).toContain(104);
  });
});

describe("resolveKnockout", () => {
  it("returns null competitors when groups are unset", () => {
    const ko = resolveKnockout(emptyPicks());
    expect(ko.r32).toHaveLength(16);
    expect(ko.r32.every((s) => s.a === null || s.b === null)).toBe(true);
    expect(ko.final.a).toBeNull();
  });

  it("resolves R32 from group picks", () => {
    const picks = emptyPicks();
    for (const g of Object.keys(GROUPS)) {
      picks.groupFirst[g] = GROUPS[g][0];
      picks.groupSecond[g] = GROUPS[g][1];
    }
    const ko = resolveKnockout(picks);
    // Match 73: 2A vs 2B → second of A vs second of B.
    const m73 = ko.r32.find((s) => s.matchNo === 73)!;
    expect(m73.a?.code).toBe(GROUPS["A"][1]);
    expect(m73.b?.code).toBe(GROUPS["B"][1]);
    expect(m73.a?.name).toBeTruthy();
  });

  it("cascades a picked R32 winner into the R16 matchup", () => {
    const picks = emptyPicks();
    for (const g of Object.keys(GROUPS)) {
      picks.groupFirst[g] = GROUPS[g][0];
      picks.groupSecond[g] = GROUPS[g][1];
    }
    picks.thirdAdvance = Object.keys(GROUPS).slice(0, 8).map((g) => GROUPS[g][2]);
    const ko = resolveKnockout(picks);
    const m73 = ko.r32.find((s) => s.matchNo === 73)!;
    picks.knockout[73] = m73.a!.code;
    picks.knockout[75] = resolveKnockout(picks).r32.find((s) => s.matchNo === 75)!.a!.code;

    // R16 match 90 feeds from 73 and 75.
    const ko2 = resolveKnockout(picks);
    const m90 = ko2.r16.find((s) => s.matchNo === 90)!;
    expect(m90.a?.code).toBe(picks.knockout[73]);
    expect(m90.b?.code).toBe(picks.knockout[75]);
  });
});

describe("pickFormProgress", () => {
  it("reports an empty bracket as 0% and incomplete", () => {
    const p = pickFormProgress(emptyPicks());
    expect(p.groups.done).toBe(0);
    expect(p.thirds.done).toBe(0);
    expect(p.knockout.done).toBe(0);
    expect(p.overall.done).toBe(0);
    expect(p.complete).toBe(false);
  });

  it("reports a full bracket as complete", () => {
    const p = pickFormProgress(fullPicks());
    expect(p.groups.done).toBe(TARGET_GROUPS);
    expect(p.thirds.done).toBe(TARGET_THIRDS);
    expect(p.knockout.done).toBe(TARGET_KNOCKOUT);
    expect(p.awards.done).toBe(4);
    expect(p.complete).toBe(true);
  });

  it("caps thirds progress at the target", () => {
    const picks = emptyPicks();
    picks.thirdAdvance = R32.slice(0, 10).map((_, i) => `T${i}`);
    expect(pickFormProgress(picks).thirds.done).toBe(TARGET_THIRDS);
  });
});

describe("validatePicks", () => {
  it("passes a clean partial bracket", () => {
    const picks = emptyPicks();
    picks.groupFirst["A"] = GROUPS["A"][0];
    picks.groupSecond["A"] = GROUPS["A"][1];
    expect(validatePicks(picks)).toEqual([]);
  });

  it("flags identical 1st and 2nd in a group", () => {
    const picks = emptyPicks();
    picks.groupFirst["A"] = GROUPS["A"][0];
    picks.groupSecond["A"] = GROUPS["A"][0];
    expect(validatePicks(picks).some((e) => e.includes("different"))).toBe(true);
  });

  it("flags a team picked twice across groups", () => {
    const picks = emptyPicks();
    picks.groupFirst["A"] = GROUPS["A"][0];
    picks.groupSecond["B"] = GROUPS["A"][0];
    expect(validatePicks(picks).some((e) => e.includes("both"))).toBe(true);
  });

  it("flags more than 8 third-place teams", () => {
    const picks = emptyPicks();
    picks.thirdAdvance = Object.keys(GROUPS).slice(0, 9).map((g) => GROUPS[g][2]);
    expect(validatePicks(picks).some((e) => e.includes("at most"))).toBe(true);
  });
});
