import { describe, it, expect } from "vitest";
import {
  snapshotsToWrite,
  computeMovers,
  type SnapshotPoint,
  type LeaderboardPoint,
} from "./movers";

function point(entryId: string, totalPoints: number, rank: number): SnapshotPoint {
  return { entryId, totalPoints, rank };
}
function row(entryId: string, total: number, rank: number): LeaderboardPoint {
  return { entryId, total, rank };
}
function latest(...points: SnapshotPoint[]): Map<string, SnapshotPoint> {
  return new Map(points.map((p) => [p.entryId, p]));
}

describe("snapshotsToWrite (dedup)", () => {
  it("writes every entry when there is no prior history", () => {
    const out = snapshotsToWrite(latest(), [row("a", 10, 1), row("b", 5, 2)]);
    expect(out).toEqual([
      { entryId: "a", totalPoints: 10, rank: 1 },
      { entryId: "b", totalPoints: 5, rank: 2 },
    ]);
  });

  it("skips entries whose points and rank are unchanged", () => {
    const prev = latest(point("a", 10, 1), point("b", 5, 2));
    const out = snapshotsToWrite(prev, [row("a", 10, 1), row("b", 5, 2)]);
    expect(out).toEqual([]);
  });

  it("writes an entry whose points changed", () => {
    const prev = latest(point("a", 10, 1), point("b", 5, 2));
    const out = snapshotsToWrite(prev, [row("a", 13, 1), row("b", 5, 2)]);
    expect(out).toEqual([{ entryId: "a", totalPoints: 13, rank: 1 }]);
  });

  it("writes an entry whose rank changed even if points held", () => {
    // b overtakes a on a tiebreak/other entry shift: a's points hold but rank slips.
    const prev = latest(point("a", 10, 1), point("b", 10, 2));
    const out = snapshotsToWrite(prev, [row("b", 10, 1), row("a", 10, 2)]);
    expect(out).toEqual([
      { entryId: "b", totalPoints: 10, rank: 1 },
      { entryId: "a", totalPoints: 10, rank: 2 },
    ]);
  });

  it("writes only the newly added entry, leaving unchanged ones alone", () => {
    const prev = latest(point("a", 10, 1), point("b", 5, 2));
    const out = snapshotsToWrite(prev, [row("a", 10, 1), row("b", 5, 2), row("c", 0, 3)]);
    expect(out).toEqual([{ entryId: "c", totalPoints: 0, rank: 3 }]);
  });
});

describe("computeMovers (deltas)", () => {
  it("computes points gained and places climbed vs baseline", () => {
    const baseline = latest(point("a", 10, 1), point("b", 4, 2));
    const out = computeMovers(baseline, [point("a", 12, 2), point("b", 18, 1)]);
    // b: +14 points, climbed 1 (rank 2→1); a: +2 points, dropped 1 (rank 1→2)
    expect(out).toEqual([
      { entryId: "b", pointsGained: 14, rankDelta: 1, currentRank: 1, currentPoints: 18 },
      { entryId: "a", pointsGained: 2, rankDelta: -1, currentRank: 2, currentPoints: 12 },
    ]);
  });

  it("sorts by points gained, then by places climbed", () => {
    const baseline = latest(point("a", 0, 3), point("b", 0, 2), point("c", 0, 1));
    const out = computeMovers(baseline, [point("a", 5, 2), point("b", 5, 1), point("c", 2, 3)]);
    // a and b both +5; b climbed 1, a climbed 1 → tie on rankDelta(1 vs 1)? a:3→2=+1, b:2→1=+1
    expect(out.map((m) => m.entryId)).toEqual(["a", "b", "c"]);
    expect(out[2]).toMatchObject({ entryId: "c", pointsGained: 2, rankDelta: -2 });
  });

  it("treats an entry absent from the baseline as starting from zero, rankDelta 0", () => {
    const baseline = latest(point("a", 10, 1));
    const out = computeMovers(baseline, [point("a", 10, 2), point("new", 7, 1)]);
    const fresh = out.find((m) => m.entryId === "new");
    expect(fresh).toEqual({
      entryId: "new",
      pointsGained: 7,
      rankDelta: 0,
      currentRank: 1,
      currentPoints: 7,
    });
  });
});
