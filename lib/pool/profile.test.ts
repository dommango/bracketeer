import { describe, it, expect } from "vitest";
import { buildProfile, tallyPickShare, type ProfileInput } from "./profile";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";

function picks(knockout: Record<number, string>): Picks {
  return { ...emptyPicks(), knockout };
}
function results(knockout: Record<number, string>): Results {
  return { ...emptyPicks(), knockout, finalGoals: null };
}

function input(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return {
    entryId: "e1",
    label: "Ana",
    total: 10,
    rank: 1,
    entryCount: 5,
    picks: picks({}),
    results: results({}),
    breakdown: null,
    pickShareByMatch: {},
    ...overrides,
  };
}

describe("buildProfile — hit grid", () => {
  it("covers all 31 scored knockout matches and excludes the bronze final", () => {
    const grid = buildProfile(input()).hitGrid;
    expect(grid).toHaveLength(31);
    expect(grid.some((h) => h.matchNo === 103)).toBe(false);
    expect(grid.some((h) => h.matchNo === 104)).toBe(true);
  });

  it("marks hit / miss / pending correctly", () => {
    const grid = buildProfile(
      input({
        picks: picks({ 73: "MEX", 74: "CAN" }),
        results: results({ 73: "MEX", 74: "BRA" }), // 75 undecided
      }),
    ).hitGrid;
    expect(grid.find((h) => h.matchNo === 73)?.result).toBe("hit");
    expect(grid.find((h) => h.matchNo === 74)?.result).toBe("miss");
    expect(grid.find((h) => h.matchNo === 75)?.result).toBe("pending");
  });
});

describe("buildProfile — accuracy", () => {
  it("counts only decided matches the entry picked", () => {
    const acc = buildProfile(
      input({
        picks: picks({ 73: "MEX", 74: "CAN", 75: "BRA" }),
        results: results({ 73: "MEX", 74: "BRA" }), // 73 hit, 74 miss, 75 undecided
      }),
    ).accuracy;
    expect(acc).toEqual({ hits: 1, decided: 2, pct: 50 });
  });

  it("is zero when nothing is decided", () => {
    expect(buildProfile(input()).accuracy).toEqual({ hits: 0, decided: 0, pct: 0 });
  });
});

describe("buildProfile — categories", () => {
  it("maps the byCategory breakdown into labelled lines in fixed order", () => {
    const cats = buildProfile(
      input({ breakdown: { group: 9, thirds: 3, r32: 2, r16: 0, qf: 0, sf: 0, final: 0, awards: 1 } }),
    ).categories;
    expect(cats[0]).toEqual({ key: "group", label: "Groups", points: 9 });
    expect(cats.find((c) => c.key === "awards")?.points).toBe(1);
    expect(cats).toHaveLength(8);
  });
});

describe("buildProfile — boldest call", () => {
  it("picks the rarest correct knockout call", () => {
    const profile = buildProfile(
      input({
        picks: picks({ 73: "MEX", 89: "BRA" }),
        results: results({ 73: "MEX", 89: "BRA" }),
        pickShareByMatch: {
          73: { total: 10, byCode: { MEX: 8 } }, // 80% shared — chalk
          89: { total: 10, byCode: { BRA: 1 } }, // 10% shared — bold
        },
      }),
    );
    expect(profile.boldest?.matchNo).toBe(89);
    expect(profile.boldest?.sharePct).toBe(10);
    expect(profile.boldest?.pickName).toBe("Brazil");
  });

  it("is null when there are no correct knockout calls", () => {
    const profile = buildProfile(
      input({ picks: picks({ 73: "MEX" }), results: results({ 73: "CAN" }) }),
    );
    expect(profile.boldest).toBeNull();
  });
});

describe("tallyPickShare", () => {
  it("counts winner picks per match across entries", () => {
    const share = tallyPickShare([
      picks({ 73: "MEX", 74: "BRA" }),
      picks({ 73: "MEX" }),
      picks({ 73: "CAN" }),
    ]);
    expect(share[73]).toEqual({ total: 3, byCode: { MEX: 2, CAN: 1 } });
    expect(share[74]).toEqual({ total: 1, byCode: { BRA: 1 } });
    expect(share[104]).toEqual({ total: 0, byCode: {} });
  });
});
