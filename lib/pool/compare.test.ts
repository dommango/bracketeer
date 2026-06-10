import { describe, it, expect } from "vitest";
import { knockoutDivergences } from "./compare";
import { DEFAULT_SCORING } from "@/lib/scoring/score";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";

const picks = (o: Partial<Picks> = {}): Picks => ({ ...emptyPicks(), ...o });
const results = (o: Partial<Results> = {}): Results => ({ ...emptyPicks(), finalGoals: null, ...o });

describe("knockoutDivergences", () => {
  it("lists only matches where the two picked different winners, deepest round first", () => {
    const a = picks({ knockout: { 73: "BRA", 104: "ARG" } });
    const b = picks({ knockout: { 73: "BRA", 104: "FRA" } }); // agree on 73, differ on final
    const d = knockoutDivergences(a, b, results(), DEFAULT_SCORING);
    expect(d.map((x) => x.matchNo)).toEqual([104]);
    expect(d[0]).toMatchObject({ aCode: "ARG", bCode: "FRA", decided: false });
  });

  it("marks who was correct once the match is decided", () => {
    const a = picks({ knockout: { 89: "ESP" } });
    const b = picks({ knockout: { 89: "GER" } });
    const d = knockoutDivergences(a, b, results({ knockout: { 89: "ESP" } }), DEFAULT_SCORING);
    expect(d[0]).toMatchObject({ aCorrect: true, bCorrect: false, points: DEFAULT_SCORING.r16 });
  });

  it("includes a match where only one side made a pick", () => {
    const a = picks({ knockout: { 97: "NED" } });
    const b = picks();
    const d = knockoutDivergences(a, b, results(), DEFAULT_SCORING);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ aCode: "NED", bCode: null });
  });

  it("returns nothing for identical brackets", () => {
    const a = picks({ knockout: { 73: "BRA", 104: "BRA" } });
    expect(knockoutDivergences(a, a, results(), DEFAULT_SCORING)).toEqual([]);
  });
});
