import { describe, it, expect } from "vitest";
import { buildPoolStandouts, type StandoutInput } from "./standouts";
import { emptyPicks } from "@/lib/scoring/types";
import type { Picks } from "@/lib/scoring/types";

// A minimal entry: champion + finalists + a couple of group winners, plus EV.
function entry(
  entryId: string,
  champ: string,
  opts: { finalists?: [string, string]; groups?: Partial<Record<string, string>>; ev?: number | null } = {},
): StandoutInput {
  const picks: Picks = emptyPicks();
  picks.knockout[104] = champ;
  if (opts.finalists) {
    picks.knockout[101] = opts.finalists[0];
    picks.knockout[102] = opts.finalists[1];
  }
  for (const [g, code] of Object.entries(opts.groups ?? {})) picks.groupFirst[g as keyof typeof picks.groupFirst] = code!;
  return { entryId, label: entryId.toUpperCase(), picks, expectedRemaining: opts.ev ?? null };
}

describe("buildPoolStandouts", () => {
  it("returns empty standouts for an empty pool", () => {
    const out = buildPoolStandouts([]);
    expect(out.totalEntries).toBe(0);
    expect(out.upside).toEqual([]);
    expect(out.contrarian).toEqual([]);
    expect(out.diversity).toEqual({ distinctChampions: 0, index: 0 });
  });

  it("ranks upside by expected remaining points, dropping entries without EV", () => {
    const out = buildPoolStandouts([
      entry("a", "BRA", { ev: 3.2 }),
      entry("b", "ARG", { ev: 5.1 }),
      entry("c", "FRA", { ev: null }), // no EV → excluded from upside
    ]);
    expect(out.upside.map((r) => r.entryId)).toEqual(["b", "a"]);
    expect(out.upside[0].value).toBeCloseTo(5.1, 6);
  });

  it("scores the most against-the-grain bracket highest", () => {
    // BRA is the consensus champion (3 of 4); the lone ENG pick is the contrarian.
    const out = buildPoolStandouts([
      entry("a", "BRA"),
      entry("b", "BRA"),
      entry("c", "BRA"),
      entry("d", "ENG"),
    ]);
    expect(out.contrarian[0].entryId).toBe("d");
    // ENG champion share is 1/4 → rarity 0.75 → 75 (champion is d's only signature pick here).
    expect(out.contrarian[0].value).toBe(75);
    // A consensus picker scores lower than the contrarian.
    const consensus = out.contrarian.find((r) => r.entryId === "a")!;
    expect(consensus.value).toBeLessThan(out.contrarian[0].value);
  });

  it("measures champion diversity with a Gini–Simpson index", () => {
    // Unanimous champion → index 0, one distinct pick.
    const unanimous = buildPoolStandouts([entry("a", "BRA"), entry("b", "BRA")]);
    expect(unanimous.diversity).toEqual({ distinctChampions: 1, index: 0 });

    // Two entries, two different champions → index 1 - (0.5² + 0.5²) = 0.5.
    const split = buildPoolStandouts([entry("a", "BRA"), entry("b", "ARG")]);
    expect(split.diversity.distinctChampions).toBe(2);
    expect(split.diversity.index).toBeCloseTo(0.5, 6);
  });

  it("includes finalist and group-winner rarity in the contrarian score", () => {
    // Everyone shares champion BRA, but only 'odd' diverges on group A + a finalist,
    // so its mean rarity (and score) exceeds the rest.
    const out = buildPoolStandouts([
      entry("p", "BRA", { finalists: ["BRA", "ARG"], groups: { A: "MEX" } }),
      entry("q", "BRA", { finalists: ["BRA", "ARG"], groups: { A: "MEX" } }),
      entry("odd", "BRA", { finalists: ["BRA", "ESP"], groups: { A: "KOR" } }),
    ]);
    expect(out.contrarian[0].entryId).toBe("odd");
  });

  it("does not mutate its input", () => {
    const entries = [entry("a", "BRA", { ev: 1 }), entry("b", "ARG", { ev: 2 })];
    const snapshot = JSON.stringify(entries);
    buildPoolStandouts(entries);
    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
