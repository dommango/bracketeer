import { describe, it, expect } from "vitest";
import {
  buildStanding,
  buildStandings,
  selectNextMatch,
  type LeaderboardLike,
  type MatchLite,
} from "./home";

function lb(rank: number, entryId: string, userId: string | null, total: number): LeaderboardLike {
  return { rank, entryId, label: entryId, userId, total };
}

describe("buildStanding (gap math)", () => {
  const board = [
    lb(1, "a", "ua", 50),
    lb(2, "b", "ub", 42),
    lb(3, "c", "uc", 30),
  ];

  it("returns null when the user is anonymous", () => {
    expect(buildStanding(board, null)).toBeNull();
  });

  it("returns null when the user has no entry in this pool", () => {
    expect(buildStanding(board, "stranger")).toBeNull();
  });

  it("computes gap to leader and gap to the entry above for a mid-pack entry", () => {
    expect(buildStanding(board, "ub")).toEqual({
      rank: 2,
      entryId: "b",
      label: "b",
      total: 42,
      entryCount: 3,
      gapToLeader: 8, // 50 − 42
      gapToNext: 8, // entry above (a, 50) − 42
    });
  });

  it("reports zero gap-to-leader and null gap-to-next for the leader", () => {
    expect(buildStanding(board, "ua")).toMatchObject({
      rank: 1,
      gapToLeader: 0,
      gapToNext: null,
    });
  });
});

describe("buildStandings (multi-entry)", () => {
  // ua owns two brackets (a at #1, d at #4); ub owns one.
  const board = [
    lb(1, "a", "ua", 50),
    lb(2, "b", "ub", 42),
    lb(3, "c", "uc", 30),
    lb(4, "d", "ua", 18),
  ];

  it("returns an empty array when the user is anonymous", () => {
    expect(buildStandings(board, null)).toEqual([]);
  });

  it("returns an empty array when the user has no entry here", () => {
    expect(buildStandings(board, "stranger")).toEqual([]);
  });

  it("returns all of a user's entries in rank order, each with its own gaps", () => {
    const standings = buildStandings(board, "ua");
    expect(standings.map((s) => s.entryId)).toEqual(["a", "d"]);
    expect(standings[0]).toMatchObject({ rank: 1, gapToLeader: 0, gapToNext: null });
    // d at #4: 50 − 18 behind leader; entry above is c (30) → 12 to next.
    expect(standings[1]).toMatchObject({ rank: 4, gapToLeader: 32, gapToNext: 12 });
  });

  it("buildStanding returns the top-ranked of a user's entries", () => {
    expect(buildStanding(board, "ua")?.entryId).toBe("a");
  });
});

describe("selectNextMatch", () => {
  const now = new Date("2026-06-11T18:00:00Z");
  const m = (matchNo: number, scheduledAt: Date | null, scored: boolean): MatchLite => ({
    matchNo,
    roundCode: "GROUP",
    scheduledAt,
    scored,
  });

  it("returns null once every match is scored", () => {
    expect(selectNextMatch([m(1, null, true), m(2, null, true)], now)).toBeNull();
  });

  it("picks the soonest upcoming unscored match", () => {
    const picked = selectNextMatch(
      [
        m(1, new Date("2026-06-11T16:00:00Z"), true), // past, scored
        m(3, new Date("2026-06-12T15:00:00Z"), false), // later
        m(2, new Date("2026-06-11T21:00:00Z"), false), // soonest upcoming
      ],
      now,
    );
    expect(picked?.matchNo).toBe(2);
  });

  it("falls back to the lowest-numbered unscored match when nothing is scheduled (pre-draw)", () => {
    const picked = selectNextMatch([m(5, null, false), m(3, null, false), m(9, null, false)], now);
    expect(picked?.matchNo).toBe(3);
  });

  it("does not skip unscheduled earlier matches for a future knockout date", () => {
    const picked = selectNextMatch(
      [
        m(1, null, false),
        { ...m(73, new Date("2026-06-27T19:00:00Z"), false), roundCode: "R32" },
      ],
      now,
    );
    expect(picked?.matchNo).toBe(1);
  });

  it("falls back to lowest unscored when all scheduled times are in the past", () => {
    const picked = selectNextMatch(
      [m(7, new Date("2026-06-10T12:00:00Z"), false), m(4, new Date("2026-06-09T12:00:00Z"), false)],
      now,
    );
    expect(picked?.matchNo).toBe(4);
  });
});
