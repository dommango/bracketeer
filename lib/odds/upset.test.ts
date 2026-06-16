import { describe, it, expect } from "vitest";
import { buildUpsetRadar, stakedTeamCodes, type UpsetMatchInput } from "./upset";
import { emptyPicks, type Picks } from "@/lib/scoring/types";

// Build a match with implied probs that already sum to 1.
function match(
  matchNo: number,
  homeCode: string | null,
  awayCode: string | null,
  homeWinProb: number,
  drawProb: number,
  awayWinProb: number,
): UpsetMatchInput {
  return { matchNo, scheduledAt: null, homeCode, awayCode, odds: { homeWinProb, drawProb, awayWinProb } };
}

describe("buildUpsetRadar", () => {
  it("ranks by underdog win probability (closest games first)", () => {
    const rows = buildUpsetRadar([
      match(1, "BRA", "KOR", 0.6, 0.2, 0.2), // dog 0.20
      match(2, "ENG", "USA", 0.45, 0.1, 0.45), // dog 0.45 (toss-up)
      match(3, "FRA", "CAN", 0.5, 0.2, 0.3), // dog 0.30
    ]);
    expect(rows.map((r) => r.matchNo)).toEqual([2, 3, 1]);
  });

  it("drops chalk below the upset floor", () => {
    const rows = buildUpsetRadar([match(1, "BRA", "HAI", 0.85, 0.1, 0.05)]);
    expect(rows).toEqual([]);
  });

  it("classifies a near-even match as a toss-up and a clear favorite as an upset alert", () => {
    const [toss] = buildUpsetRadar([match(1, "ENG", "USA", 0.46, 0.1, 0.44)]);
    expect(toss.kind).toBe("tossup");
    const [alert] = buildUpsetRadar([match(2, "FRA", "CAN", 0.55, 0.2, 0.25)]);
    expect(alert.kind).toBe("upsetAlert");
  });

  it("treats a draw-heavy fixture as a fragile-favorite alert, not a toss-up", () => {
    // 0.40 / 0.35 draw / 0.25 — close on paper, but the favorite-underdog gap
    // (0.15) exceeds the toss-up margin since the metric is draw-blind.
    const [row] = buildUpsetRadar([match(1, "GER", "MAR", 0.4, 0.35, 0.25)]);
    expect(row.kind).toBe("upsetAlert");
    expect(row.underdog.code).toBe("MAR");
  });

  it("picks the higher win-prob as favorite (away can be favorite)", () => {
    const [row] = buildUpsetRadar([match(1, "CAN", "ARG", 0.25, 0.2, 0.55)]);
    expect(row.favorite.code).toBe("ARG");
    expect(row.underdog.code).toBe("CAN");
  });

  it("tags the viewer's stake on whichever side they backed", () => {
    const staked = new Set(["KOR"]);
    const [row] = buildUpsetRadar([match(1, "BRA", "KOR", 0.55, 0.15, 0.3)], staked);
    expect(row.stake).toEqual({ code: "KOR", side: "underdog" });

    const favStake = new Set(["BRA"]);
    const [row2] = buildUpsetRadar([match(1, "BRA", "KOR", 0.55, 0.15, 0.3)], favStake);
    expect(row2.stake).toEqual({ code: "BRA", side: "favorite" });
  });

  it("caps the radar to the requested limit", () => {
    const rows = buildUpsetRadar(
      [
        match(1, "A", "B", 0.5, 0.1, 0.4),
        match(2, "C", "D", 0.5, 0.1, 0.4),
        match(3, "E", "F", 0.5, 0.1, 0.4),
      ],
      new Set(),
      2,
    );
    expect(rows).toHaveLength(2);
  });

  it("skips matches with missing teams or unusable odds", () => {
    const rows = buildUpsetRadar([
      match(1, null, "KOR", 0.5, 0.1, 0.4),
      match(2, "BRA", "KOR", 0.5, 0.1, 0.1), // sums to 0.7 — not normalized
      { matchNo: 3, scheduledAt: null, homeCode: "BRA", awayCode: "KOR", odds: null },
    ]);
    expect(rows).toEqual([]);
  });
});

describe("stakedTeamCodes", () => {
  it("collects group winners, finalists and champion, ignoring empties", () => {
    const picks: Picks = {
      ...emptyPicks(),
      groupFirst: { A: "BRA", B: "" },
      knockout: { 101: "ARG", 102: "FRA", 104: "ARG" },
    };
    expect(stakedTeamCodes(picks)).toEqual(new Set(["BRA", "ARG", "FRA"]));
  });
});
