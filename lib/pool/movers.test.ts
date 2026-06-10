import { describe, it, expect } from "vitest";
import { diffSnapshots, type SnapRow } from "./movers";

const row = (entryId: string, totalPoints: number, rank: number): SnapRow => ({
  entryId,
  label: entryId,
  totalPoints,
  rank,
});

describe("diffSnapshots", () => {
  it("reports point gains and rank climbs, biggest gain first", () => {
    const prev = [row("a", 10, 1), row("b", 8, 2), row("c", 5, 3)];
    const curr = [row("b", 20, 1), row("a", 12, 2), row("c", 5, 3)];
    const movers = diffSnapshots(prev, curr);
    expect(movers.map((m) => m.entryId)).toEqual(["b", "a"]); // c didn't move → dropped
    expect(movers[0]).toMatchObject({ entryId: "b", deltaPoints: 12, deltaRank: 1, rank: 1 });
    expect(movers[1]).toMatchObject({ entryId: "a", deltaPoints: 2, deltaRank: -1 });
  });

  it("treats an entry absent from the previous batch as starting at zero", () => {
    const movers = diffSnapshots([], [row("new", 7, 1)]);
    expect(movers[0]).toMatchObject({ entryId: "new", deltaPoints: 7, deltaRank: 0 });
  });

  it("includes a pure rank climb even with no point change", () => {
    // Both gained nothing in points, but a overtook b on a tiebreak/recompute.
    const prev = [row("b", 10, 1), row("a", 10, 2)];
    const curr = [row("a", 10, 1), row("b", 10, 2)];
    const movers = diffSnapshots(prev, curr);
    expect(movers.find((m) => m.entryId === "a")).toMatchObject({ deltaPoints: 0, deltaRank: 1 });
  });

  it("returns nothing when no one moved", () => {
    const same = [row("a", 5, 1), row("b", 3, 2)];
    expect(diffSnapshots(same, same)).toEqual([]);
  });
});
