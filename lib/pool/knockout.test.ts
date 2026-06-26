import { describe, it, expect } from "vitest";
import {
  knockoutR32Seed,
  isKnockoutFieldSet,
  isKnockoutLocked,
  knockoutOnlyPicks,
  hasConcreteR32Slots,
  knockoutOpenState,
} from "./knockout";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks } from "@/lib/scoring/types";
import type { Results } from "@/lib/scoring/types";

function completeResults(): Results {
  const r: Results = { ...emptyPicks(), finalGoals: null };
  for (const g of Object.keys(GROUPS)) {
    r.groupFirst[g] = GROUPS[g][0];
    r.groupSecond[g] = GROUPS[g][1];
  }
  r.thirdAdvance = Object.keys(GROUPS).slice(0, 8).map((g) => GROUPS[g][2]);
  return r;
}

describe("knockoutR32Seed / isKnockoutFieldSet", () => {
  it("reports the field as not set when group standings are empty", () => {
    expect(isKnockoutFieldSet({ ...emptyPicks(), finalGoals: null })).toBe(false);
  });

  it("reports the field as set once all 12 groups + 8 thirds are decided", () => {
    const results = completeResults();
    expect(isKnockoutFieldSet(results)).toBe(true);
    // The derived seed gives every R32 match (73–88) two concrete teams.
    const seed = knockoutR32Seed(results);
    for (let id = 73; id <= 88; id++) {
      expect(seed[id].a).toBeTruthy();
      expect(seed[id].b).toBeTruthy();
    }
  });

  it("is not set when thirds are incomplete — even though the seed's fallback fills slots", () => {
    const r = completeResults();
    r.thirdAdvance = r.thirdAdvance.slice(0, 5); // only 5 of 8 → field not decided
    expect(isKnockoutFieldSet(r)).toBe(false);
  });

  it("is not set when a single group standing is missing", () => {
    const r = completeResults();
    r.groupSecond["L"] = "";
    expect(isKnockoutFieldSet(r)).toBe(false);
  });
});

describe("knockoutOpenState / hasConcreteR32Slots", () => {
  // All 12 groups' 1st & 2nd set but no third-place advancers — the field isn't
  // final, yet the R32 matches that pair two group positions are already concrete.
  function groupsOnlyResults(): Results {
    const r = completeResults();
    r.thirdAdvance = [];
    return r;
  }

  it("is closed before any matchup is concrete (empty standings)", () => {
    const r: Results = { ...emptyPicks(), finalGoals: null };
    expect(hasConcreteR32Slots(r)).toBe(false);
    expect(knockoutOpenState(r)).toEqual({ open: false, provisional: false });
  });

  it("is provisionally open once some R32 matchups are concrete but the field isn't final", () => {
    const r = groupsOnlyResults();
    expect(isKnockoutFieldSet(r)).toBe(false);
    expect(hasConcreteR32Slots(r)).toBe(true);
    expect(knockoutOpenState(r)).toEqual({ open: true, provisional: true });
  });

  it("is open and final once all 32 qualifiers are seated", () => {
    const r = completeResults();
    expect(knockoutOpenState(r)).toEqual({ open: true, provisional: false });
  });
});

describe("knockoutOnlyPicks", () => {
  it("keeps knockout winners + awards and drops group / third-place data", () => {
    const picks = emptyPicks();
    picks.groupFirst["A"] = GROUPS["A"][0];
    picks.groupSecond["A"] = GROUPS["A"][1];
    picks.thirdAdvance = [GROUPS["A"][2], GROUPS["B"][2]];
    picks.knockout[73] = "BRA";
    picks.knockout[104] = "ARG";
    picks.awards = { player: "Messi", young: "Yamal", boot: "Kane", goal: "X" };

    const out = knockoutOnlyPicks(picks);
    expect(out.groupFirst).toEqual({});
    expect(out.groupSecond).toEqual({});
    expect(out.thirdAdvance).toEqual([]);
    expect(out.knockout).toEqual({ 73: "BRA", 104: "ARG" });
    expect(out.awards).toEqual({ player: "Messi", young: "Yamal", boot: "Kane", goal: "X" });
  });

  it("does not mutate the input", () => {
    const picks = emptyPicks();
    picks.groupFirst["A"] = "BRA";
    const before = JSON.stringify(picks);
    knockoutOnlyPicks(picks);
    expect(JSON.stringify(picks)).toBe(before);
  });
});

describe("isKnockoutLocked", () => {
  const kickoff = new Date("2026-06-27T16:00:00Z");

  it("is unlocked before the R32 kickoff", () => {
    expect(isKnockoutLocked(kickoff, false, new Date("2026-06-27T15:59:00Z"))).toBe(false);
  });

  it("is locked at/after the R32 kickoff", () => {
    expect(isKnockoutLocked(kickoff, false, new Date("2026-06-27T16:00:00Z"))).toBe(true);
    expect(isKnockoutLocked(kickoff, false, new Date("2026-06-28T00:00:00Z"))).toBe(true);
  });

  it("is locked when an admin has locked the entry, regardless of time", () => {
    expect(isKnockoutLocked(kickoff, true, new Date("2026-06-01T00:00:00Z"))).toBe(true);
  });

  it("never time-locks when no kickoff time is known", () => {
    expect(isKnockoutLocked(null, false, new Date("2030-01-01T00:00:00Z"))).toBe(false);
    expect(isKnockoutLocked(null, true)).toBe(true);
  });
});
