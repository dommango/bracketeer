import { describe, it, expect } from "vitest";
import {
  resolveKnockout,
  reconcileKnockoutPicks,
  inconsistentKnockoutPicks,
  pickFormProgress,
  knockoutOnlyProgress,
  validatePicks,
  scoredKnockoutNumbers,
  TARGET_GROUPS,
  TARGET_THIRDS,
  TARGET_KNOCKOUT,
  TARGET_AWARDS,
} from "./pick-form";
import { GROUPS, R32 } from "@/lib/scoring/data";
import { resolveR32Slots, type ResolvedR32 } from "@/lib/scoring/resolve";
import { emptyPicks } from "@/lib/scoring/types";
import type { Picks } from "@/lib/scoring/types";

// An official-results-style answer key whose group standings are fully set, used
// to derive a concrete R32 seed (the 32 qualifiers) for knockout-pool tests.
function officialR32Seed(): ResolvedR32 {
  const results = emptyPicks();
  for (const g of Object.keys(GROUPS)) {
    results.groupFirst[g] = GROUPS[g][0];
    results.groupSecond[g] = GROUPS[g][1];
  }
  results.thirdAdvance = Object.keys(GROUPS).slice(0, 8).map((g) => GROUPS[g][2]);
  return resolveR32Slots(results);
}

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

describe("resolveKnockout with an R32 seed", () => {
  it("seeds R32 matchups from the supplied seed, ignoring the picker's group picks", () => {
    const seed = officialR32Seed();
    // Picker has NO group picks of their own — a knockout-pool entry never sets them.
    const ko = resolveKnockout(emptyPicks(), seed);
    const m73 = ko.r32.find((s) => s.matchNo === 73)!;
    expect(m73.a?.code).toBe(seed[73].a);
    expect(m73.b?.code).toBe(seed[73].b);
    expect(m73.a?.name).toBeTruthy();
  });

  it("cascades the picker's R32 winner into the seeded R16 matchup", () => {
    const seed = officialR32Seed();
    const picks = emptyPicks();
    const m73 = resolveKnockout(picks, seed).r32.find((s) => s.matchNo === 73)!;
    const m75 = resolveKnockout(picks, seed).r32.find((s) => s.matchNo === 75)!;
    picks.knockout[73] = m73.a!.code;
    picks.knockout[75] = m75.a!.code;

    // R16 match 90 feeds from 73 and 75.
    const m90 = resolveKnockout(picks, seed).r16.find((s) => s.matchNo === 90)!;
    expect(m90.a?.code).toBe(picks.knockout[73]);
    expect(m90.b?.code).toBe(picks.knockout[75]);
  });
});

describe("resolveKnockout with a JSON-serialized seed", () => {
  it("works after the seed crosses the server→client boundary (numeric keys → strings)", () => {
    const seed = officialR32Seed();
    const wireSeed = JSON.parse(JSON.stringify(seed)) as ResolvedR32;
    const direct = resolveKnockout(emptyPicks(), seed).r32.find((s) => s.matchNo === 73)!;
    const overWire = resolveKnockout(emptyPicks(), wireSeed).r32.find((s) => s.matchNo === 73)!;
    expect(overWire.a?.code).toBe(direct.a?.code);
    expect(overWire.b?.code).toBe(direct.b?.code);
  });
});

describe("reconcileKnockoutPicks", () => {
  it("drops a downstream pick when its feeder winner changes (seeded)", () => {
    const seed = officialR32Seed();
    const picks = emptyPicks();
    const m73 = resolveKnockout(picks, seed).r32.find((s) => s.matchNo === 73)!;
    const m75 = resolveKnockout(picks, seed).r32.find((s) => s.matchNo === 75)!;
    picks.knockout[73] = m73.a!.code;
    picks.knockout[75] = m75.a!.code;
    // R16 match 90 feeds from 73 and 75; pick its 'a' winner.
    const m90 = resolveKnockout(picks, seed).r16.find((s) => s.matchNo === 90)!;
    picks.knockout[90] = m90.a!.code;

    // Now flip the 73 winner to the other team: M90's 'a' side no longer exists,
    // so the M90 pick must be dropped.
    const flipped = { ...picks, knockout: { ...picks.knockout, 73: m73.b!.code } };
    const reconciled = reconcileKnockoutPicks(flipped, seed);
    expect(reconciled.knockout[90]).toBeUndefined();
    expect(reconciled.knockout[73]).toBe(m73.b!.code);
  });

  it("does not mutate the input picks", () => {
    const seed = officialR32Seed();
    const picks = emptyPicks();
    picks.knockout[90] = "ZZZ"; // a winner with no valid feeders → should be dropped
    const before = JSON.stringify(picks);
    reconcileKnockoutPicks(picks, seed);
    expect(JSON.stringify(picks)).toBe(before);
  });
});

describe("inconsistentKnockoutPicks", () => {
  it("returns no offenders for a seeded bracket filled by cascading", () => {
    const seed = officialR32Seed();
    const picks = emptyPicks();
    for (let pass = 0; pass < 6; pass++) {
      const ko = resolveKnockout(picks, seed);
      for (const s of [...ko.r32, ...ko.r16, ...ko.qf, ...ko.sf, ko.final]) {
        if (s.a) picks.knockout[s.matchNo] = s.a.code;
      }
    }
    expect(inconsistentKnockoutPicks(picks, seed)).toEqual([]);
  });

  it("flags a winner that is not one of the match's two teams", () => {
    const seed = officialR32Seed();
    const picks = emptyPicks();
    picks.knockout[73] = "ZZZ"; // not in match 73
    expect(inconsistentKnockoutPicks(picks, seed)).toContain(73);
  });
});

describe("knockoutOnlyProgress", () => {
  it("counts only knockout winners + awards, not groups/thirds", () => {
    const seed = officialR32Seed();
    const picks = emptyPicks();
    // Fill every scored knockout winner by cascading the 'a' side forward.
    for (let pass = 0; pass < 6; pass++) {
      const ko = resolveKnockout(picks, seed);
      for (const slot of [...ko.r32, ...ko.r16, ...ko.qf, ...ko.sf, ko.final]) {
        if (slot.a) picks.knockout[slot.matchNo] = slot.a.code;
      }
    }
    picks.awards = { player: "A", young: "B", boot: "C", goal: "D" };

    const p = knockoutOnlyProgress(picks);
    expect(p.groups.total).toBe(0);
    expect(p.thirds.total).toBe(0);
    expect(p.knockout.done).toBe(TARGET_KNOCKOUT);
    expect(p.awards.done).toBe(TARGET_AWARDS);
    expect(p.overall.total).toBe(TARGET_KNOCKOUT + TARGET_AWARDS);
    expect(p.complete).toBe(true);
  });

  it("is incomplete with knockout winners missing, regardless of awards", () => {
    const p = knockoutOnlyProgress(emptyPicks());
    expect(p.knockout.done).toBe(0);
    expect(p.complete).toBe(false);
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
