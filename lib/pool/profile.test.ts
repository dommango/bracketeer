import { describe, it, expect } from "vitest";
import {
  knockoutAccuracy,
  eliminatedTeams,
  championStatus,
  remainingPotential,
  boldestCall,
} from "./profile";
import { DEFAULT_SCORING } from "@/lib/scoring/score";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";

function picks(overrides: Partial<Picks> = {}): Picks {
  return { ...emptyPicks(), ...overrides };
}
function results(overrides: Partial<Results> = {}): Results {
  return { ...emptyPicks(), finalGoals: null, ...overrides };
}

describe("knockoutAccuracy", () => {
  it("counts only decided matches and the ones called correctly", () => {
    const p = picks({ knockout: { 73: "BRA", 74: "ARG", 89: "ESP" } });
    const r = results({ knockout: { 73: "BRA", 74: "GER" } }); // 89 undecided
    expect(knockoutAccuracy(p, r)).toEqual({ decided: 2, correct: 1, pct: 50 });
  });

  it("is zero when nothing is decided", () => {
    expect(knockoutAccuracy(picks(), results())).toEqual({ decided: 0, correct: 0, pct: 0 });
  });
});

describe("eliminatedTeams", () => {
  it("marks the loser of a decided R32 match as out", () => {
    // M73 = 2A vs 2B. Seed group standings so both teams resolve, then record a winner.
    const r = results({
      groupSecond: { A: "RSA", B: "SUI" },
      knockout: { 73: "RSA" },
    });
    const out = eliminatedTeams(r);
    expect(out.has("SUI")).toBe(true);
    expect(out.has("RSA")).toBe(false);
  });
});

describe("championStatus", () => {
  it("reports the final pick alive until it is eliminated", () => {
    const p = picks({ knockout: { 104: "BRA" } });
    expect(championStatus(p, results()).alive).toBe(true);

    const eliminated = results({
      groupFirst: { C: "BRA" },
      groupSecond: { F: "JPN" },
      knockout: { 76: "JPN" }, // M76 = 1C vs 2F → BRA loses
    });
    expect(championStatus(p, eliminated)).toMatchObject({ code: "BRA", alive: false });
  });

  it("handles a missing champion pick", () => {
    expect(championStatus(picks(), results())).toEqual({ code: null, name: null, alive: false });
  });
});

describe("remainingPotential", () => {
  it("adds full value for undecided slots the entry still has a live pick in", () => {
    const p = picks({
      groupFirst: { A: "MEX" },
      knockout: { 73: "MEX", 104: "MEX" },
      awards: { player: "Messi", young: "", boot: "", goal: "" },
    });
    const r = results(); // nothing decided yet
    // 1 group-first (3) + KO M73 r32 (1) + KO M104 final (5) + 1 award (1) = 10
    expect(remainingPotential(p, r, DEFAULT_SCORING)).toBe(10);
  });

  it("excludes slots already decided and picks whose team is eliminated", () => {
    const p = picks({ groupFirst: { A: "MEX" }, knockout: { 73: "MEX" } });
    const r = results({ groupFirst: { A: "MEX" } }); // group A decided → not counted
    expect(remainingPotential(p, r, DEFAULT_SCORING)).toBe(DEFAULT_SCORING.r32); // only live KO pick
  });
});

describe("boldestCall", () => {
  it("picks the correct call with the lowest pool ownership", () => {
    const p = picks({ knockout: { 73: "BRA", 89: "ARG" } });
    const r = results({ knockout: { 73: "BRA", 89: "ARG" } }); // both correct
    const counts = new Map([
      [73, new Map([["BRA", 9]])], // popular
      [89, new Map([["ARG", 2]])], // contrarian
    ]);
    const totals = new Map([
      [73, 10],
      [89, 10],
    ]);
    expect(boldestCall(p, r, DEFAULT_SCORING, counts, totals)).toMatchObject({
      matchNo: 89,
      code: "ARG",
      pct: 20,
    });
  });

  it("returns null when no correct knockout calls exist", () => {
    const p = picks({ knockout: { 73: "BRA" } });
    const r = results({ knockout: { 73: "GER" } });
    expect(boldestCall(p, r, DEFAULT_SCORING, new Map(), new Map())).toBeNull();
  });
});
