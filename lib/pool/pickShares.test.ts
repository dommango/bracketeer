import { describe, it, expect } from "vitest";
import { tallyShares } from "./pickShares";

describe("tallyShares", () => {
  const picks = [
    { code: "BRA", label: "Alice" },
    { code: "BRA", label: "Carol" },
    { code: "BRA", label: "Bob" },
    { code: "ARG", label: "Dave" },
    { code: "", label: "EmptyPick" }, // no pick made
  ];

  it("counts picks per team and sorts most-picked first", () => {
    const { totalPicks, shares } = tallyShares(picks, {
      home: "BRA",
      away: "ARG",
      winner: null,
    });
    expect(totalPicks).toBe(4); // the empty pick is ignored
    expect(shares.map((s) => s.code)).toEqual(["BRA", "ARG"]);
    expect(shares[0]).toMatchObject({ code: "BRA", count: 3, pct: 75, isContestant: true });
    expect(shares[1]).toMatchObject({ code: "ARG", count: 1, pct: 25 });
  });

  it("lists who picked each team, alphabetically", () => {
    const { shares } = tallyShares(picks, { home: "BRA", away: "ARG", winner: null });
    expect(shares[0].entryLabels).toEqual(["Alice", "Bob", "Carol"]);
  });

  it("flags the actual winner once a result is recorded", () => {
    const { shares } = tallyShares(picks, { home: "BRA", away: "ARG", winner: "ARG" });
    expect(shares.find((s) => s.code === "ARG")?.isActualWinner).toBe(true);
    expect(shares.find((s) => s.code === "BRA")?.isActualWinner).toBe(false);
  });

  it("marks teams not contesting the match as non-contestants", () => {
    // Picks can name teams that never reached this match (made pre-tournament).
    const { shares } = tallyShares(
      [{ code: "GER", label: "Zoe" }],
      { home: "BRA", away: "ARG", winner: null },
    );
    expect(shares[0]).toMatchObject({ code: "GER", isContestant: false });
  });

  it("returns an empty split when nobody picked", () => {
    expect(tallyShares([], { home: null, away: null, winner: null })).toEqual({
      totalPicks: 0,
      shares: [],
    });
  });
});
