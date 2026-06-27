import { describe, it, expect } from "vitest";
import {
  resolveAdvance,
  deriveAdvance,
  quickFillFavorites,
  validateAdvanceMap,
  asAdvanceMap,
  advanceProgress,
  type AdvanceMap,
} from "./knockout-advance";
import { resolveKnockout, scoredKnockoutNumbers } from "./pick-form";
import { GROUPS } from "@/lib/scoring/data";
import { resolveR32Slots, type ResolvedR32 } from "@/lib/scoring/resolve";
import { scorePicks } from "@/lib/scoring/score";
import { emptyPicks } from "@/lib/scoring/types";
import type { Picks, Results } from "@/lib/scoring/types";

// A fully-seated R32 seed (all 16 matches have both teams) from a complete answer
// key — the "final" state every projected seed converges to by R32 kickoff.
function fullSeed(): ResolvedR32 {
  const results = emptyPicks();
  for (const g of Object.keys(GROUPS)) {
    results.groupFirst[g] = GROUPS[g][0];
    results.groupSecond[g] = GROUPS[g][1];
  }
  results.thirdAdvance = Object.keys(GROUPS).slice(0, 8).map((g) => GROUPS[g][2]);
  return resolveR32Slots(results);
}

// Advance side "a" out of every scored match.
function advanceAllA(): AdvanceMap {
  return Object.fromEntries(scoredKnockoutNumbers().map((n) => [n, "a"])) as AdvanceMap;
}

// The all-"a" knockout the *existing* engine produces, by cascading resolveKnockout
// and picking the a-side winner at each round — the independent oracle for parity.
function expectedAllAKnockout(seed: ResolvedR32): Picks["knockout"] {
  const picks = emptyPicks();
  for (let pass = 0; pass < 6; pass++) {
    const ko = resolveKnockout(picks, seed);
    for (const slot of [...ko.r32, ...ko.r16, ...ko.qf, ...ko.sf, ko.final]) {
      if (slot.a) picks.knockout[slot.matchNo] = slot.a.code;
    }
  }
  return picks.knockout;
}

describe("resolveAdvance", () => {
  it("matches the existing cascade engine for a full all-a bracket (31 winners)", () => {
    const seed = fullSeed();
    const ko = resolveAdvance(advanceAllA(), seed);
    expect(Object.keys(ko)).toHaveLength(31);
    expect(ko).toEqual(expectedAllAKnockout(seed));
  });

  it("carries a pick forward when the seed's occupant changes — no drop", () => {
    const seed = fullSeed();
    const advance = advanceAllA();
    const before = resolveAdvance(advance, seed);

    // M73 side a feeds R16 match 90's a-side; both advance "a".
    const original = seed[73].a!;
    const replacement = GROUPS["A"][3]; // a different team in the same group
    expect(replacement).not.toBe(original);
    const swapped: ResolvedR32 = { ...seed, 73: { a: replacement, b: seed[73].b } };

    const after = resolveAdvance(advance, swapped);
    expect(before[73]).toBe(original);
    expect(after[73]).toBe(replacement); // pick re-resolves, not dropped
    expect(after[90]).toBe(replacement); // and carries downstream
  });

  it("omits a match whose chosen side is still TBD (projected null)", () => {
    const seed = fullSeed();
    const tbd: ResolvedR32 = { ...seed, 73: { a: null, b: seed[73].b } };
    const ko = resolveAdvance({ 73: "a" }, tbd);
    expect(ko[73]).toBeUndefined();
  });
});

describe("deriveAdvance", () => {
  it("round-trips with resolveAdvance", () => {
    const seed = fullSeed();
    const advance = advanceAllA();
    const knockout = resolveAdvance(advance, seed);
    const derived = deriveAdvance(knockout, seed);
    expect(resolveAdvance(derived, seed)).toEqual(knockout);
  });

  it("records the b side and omits picks matching neither competitor", () => {
    const seed = fullSeed();
    const knockout: Picks["knockout"] = { 73: seed[73].b!, 74: "ZZZ" };
    const derived = deriveAdvance(knockout, seed);
    expect(derived[73]).toBe("b");
    expect(derived[74]).toBeUndefined();
  });
});

describe("quickFillFavorites", () => {
  it("advances the higher-probability side and resolves forward to 31 winners", () => {
    const seed = fullSeed();
    const a73 = seed[73].a!;
    const b73 = seed[73].b!;
    const advance = quickFillFavorites(seed, [
      { teamCode: b73, decimal: 2, winProb: 0.9 },
      { teamCode: a73, decimal: 10, winProb: 0.1 },
    ]);
    expect(advance[73]).toBe("b");
    expect(Object.keys(resolveAdvance(advance, seed))).toHaveLength(31);
  });

  it("defaults to side a when neither team is priced (odds off)", () => {
    const seed = fullSeed();
    const advance = quickFillFavorites(seed, []);
    expect(resolveAdvance(advance, seed)).toEqual(expectedAllAKnockout(seed));
  });
});

describe("scoring parity", () => {
  it("resolveAdvance output scores identically to hand-authored team-code picks", () => {
    const seed = fullSeed();
    const fromAdvance = resolveAdvance(advanceAllA(), seed);
    const handAuthored = expectedAllAKnockout(seed);

    // Answer key where every all-a winner is correct.
    const results: Results = { ...emptyPicks(), knockout: { ...handAuthored } };
    const a = scorePicks({ ...emptyPicks(), knockout: fromAdvance }, results);
    const b = scorePicks({ ...emptyPicks(), knockout: handAuthored }, results);
    expect(a).toEqual(b);
    expect(a.breakdown.r32 + a.breakdown.r16 + a.breakdown.qf + a.breakdown.sf + a.breakdown.final)
      .toBeGreaterThan(0);
  });

  it("scores a position-only bracket once the field is final (sparse → full seed)", () => {
    // The user filled the bracket positionally with NO team info (every side = "a");
    // by R32 kickoff the official field is final and it materializes + scores.
    const advance = advanceAllA();
    const finalSeed = fullSeed();
    const knockout = resolveAdvance(advance, finalSeed);
    expect(Object.keys(knockout)).toHaveLength(31); // nothing dropped
    const results: Results = { ...emptyPicks(), knockout: { ...knockout } };
    const scored = scorePicks({ ...emptyPicks(), knockout }, results);
    const ko = scored.breakdown;
    expect(ko.r32 + ko.r16 + ko.qf + ko.sf + ko.final).toBeGreaterThan(0);
  });
});

describe("validateAdvanceMap", () => {
  it("accepts an empty map and a full all-a map", () => {
    expect(validateAdvanceMap({})).toBe(true);
    expect(validateAdvanceMap(advanceAllA())).toBe(true);
  });

  it("rejects bad match numbers, bad sides, and non-objects", () => {
    expect(validateAdvanceMap({ 73: "c" })).toBe(false); // not a side
    expect(validateAdvanceMap({ 1: "a" })).toBe(false); // group match, not knockout
    expect(validateAdvanceMap({ 103: "a" })).toBe(false); // bronze, not scored
    expect(validateAdvanceMap(null)).toBe(false);
    expect(validateAdvanceMap([["73", "a"]])).toBe(false);
  });
});

describe("asAdvanceMap", () => {
  it("passes a valid map through and falls back to empty for junk", () => {
    expect(asAdvanceMap({ 73: "a" })).toEqual({ 73: "a" });
    expect(asAdvanceMap({ 73: "x" })).toEqual({});
    expect(asAdvanceMap(undefined)).toEqual({});
  });
});

describe("advanceProgress", () => {
  it("counts chosen sides out of 31, regardless of seated teams", () => {
    expect(advanceProgress({})).toEqual({ done: 0, total: 31 });
    expect(advanceProgress(advanceAllA())).toEqual({ done: 31, total: 31 });
    expect(advanceProgress({ 73: "a", 74: "b" })).toEqual({ done: 2, total: 31 });
  });
});
