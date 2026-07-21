import { describe, it, expect } from "vitest";
import {
  expectedRemainingPoints,
  projectStandings,
  type ProjectionEntry,
} from "./expected-points";
import type { WinModel } from "./win-model";

// DEFAULT_SCORING knockout buckets: r32=1, r16=2, qf=3, sf=4, final=5.
// A hand-built model so the EV math is checkable by hand.
const model: WinModel = {
  hasData: true,
  advance: {
    73: { BRA: 0.6, ARG: 0.4 }, // R32, 1 pt
    89: { BRA: 0.3 }, // R16, 2 pts
    97: { BRA: 0.15 }, // QF, 3 pts
    104: { BRA: 0.05 }, // Final, 5 pts
  },
};

describe("expectedRemainingPoints", () => {
  it("sums P(advance) × round points over undecided matches", () => {
    // BRA picked everywhere it appears: 0.6·1 + 0.3·2 + 0.15·3 + 0.05·5 = 1.9
    const ev = expectedRemainingPoints({ 73: "BRA", 89: "BRA", 97: "BRA", 104: "BRA" }, model, {});
    expect(ev).toBeCloseTo(0.6 * 1 + 0.3 * 2 + 0.15 * 3 + 0.05 * 5, 6);
  });

  it("contributes nothing for a pick the model gives no probability", () => {
    // ENG isn't in any advance map → 0.
    expect(expectedRemainingPoints({ 73: "ENG" }, model, {})).toBe(0);
  });

  it("skips matches already decided (their points are in the actual total)", () => {
    const ev = expectedRemainingPoints({ 73: "BRA", 89: "BRA" }, model, { 73: "BRA" });
    expect(ev).toBeCloseTo(0.3 * 2, 6); // only the R16 contributes; the R32 is decided
  });

  it("ignores the bronze final and group picks", () => {
    const withBronze: WinModel = { hasData: true, advance: { ...model.advance, 103: { BRA: 1 } } };
    const ev = expectedRemainingPoints({ 103: "BRA", 50: "BRA" }, withBronze, {});
    expect(ev).toBe(0); // 103 is unscored; 50 is a group match, not knockout
  });

  it("honours a scoring-config override", () => {
    const ev = expectedRemainingPoints({ 104: "BRA" }, model, {}, {
      groupExact: 3, groupPartial: 1, thirdAdvancer: 3, r32: 1, r16: 2, qf: 3, sf: 4, final: 10, award: 1, knockoutPlacementAgnostic: 0,
    });
    expect(ev).toBeCloseTo(0.05 * 10, 6);
  });
});

describe("projectStandings", () => {
  const entries: ProjectionEntry[] = [
    { entryId: "a", actualPoints: 10, knockout: { 104: "BRA" } }, // +0.25 → 10.25
    { entryId: "b", actualPoints: 9, knockout: { 73: "BRA", 89: "BRA" } }, // +0.6+0.6 → 10.2
    { entryId: "c", actualPoints: 10, knockout: {} }, // +0 → 10.0
  ];

  it("computes projected totals and ranks by them (most-projected first)", () => {
    const out = projectStandings(entries, model, {});
    const byId = Object.fromEntries(out.map((r) => [r.entryId, r]));
    expect(byId["a"].projectedTotal).toBeCloseTo(10.25, 6);
    expect(byId["b"].projectedTotal).toBeCloseTo(10.2, 6);
    expect(byId["c"].projectedTotal).toBeCloseTo(10.0, 6);
    expect(byId["a"].projectedRank).toBe(1);
    expect(byId["b"].projectedRank).toBe(2);
    expect(byId["c"].projectedRank).toBe(3);
  });

  it("gives tied projected totals the same competition rank", () => {
    const tied: ProjectionEntry[] = [
      { entryId: "x", actualPoints: 5, knockout: {} },
      { entryId: "y", actualPoints: 5, knockout: {} },
      { entryId: "z", actualPoints: 4, knockout: {} },
    ];
    const out = projectStandings(tied, model, {});
    const byId = Object.fromEntries(out.map((r) => [r.entryId, r]));
    expect(byId["x"].projectedRank).toBe(1);
    expect(byId["y"].projectedRank).toBe(1);
    expect(byId["z"].projectedRank).toBe(3); // tie of two → next distinct skips to 3
  });

  it("ties entries whose projected totals are equal only up to float rounding", () => {
    // EV 0.1 + 0.2 = 0.30000000000000004 (classic float drift) vs a clean 0.3.
    const m: WinModel = {
      hasData: true,
      advance: { 73: { A: 0.1 }, 74: { B: 0.2, C: 0.3 } },
    };
    const drift: ProjectionEntry[] = [
      { entryId: "split", actualPoints: 0, knockout: { 73: "A", 74: "B" } }, // 0.1 + 0.2
      { entryId: "clean", actualPoints: 0, knockout: { 74: "C" } }, // 0.3
    ];
    const out = projectStandings(drift, m, {});
    const byId = Object.fromEntries(out.map((r) => [r.entryId, r]));
    expect(byId["split"].projectedTotal).not.toBe(byId["clean"].projectedTotal); // genuinely differ in float
    expect(byId["split"].projectedRank).toBe(1);
    expect(byId["clean"].projectedRank).toBe(1); // …but still share the rank
  });

  it("does not mutate its input entries", () => {
    const snapshot = JSON.stringify(entries);
    projectStandings(entries, model, {});
    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
