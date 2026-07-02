import { describe, it, expect } from "vitest";
import { buildMatchCenter, orientScorePrediction, type MatchInput } from "./match-center";

function m(partial: Partial<MatchInput> & { matchNo: number; roundCode: string }): MatchInput {
  return {
    scheduledAt: null,
    homeCode: null,
    awayCode: null,
    homeScore: null,
    awayScore: null,
    winnerCode: null,
    resultStatus: null,
    ...partial,
  };
}

describe("buildMatchCenter", () => {
  it("groups by round in tournament order and drops empty rounds", () => {
    const sections = buildMatchCenter([
      m({ matchNo: 104, roundCode: "FINAL" }),
      m({ matchNo: 1, roundCode: "GROUP", homeCode: "MEX", awayCode: "RSA" }),
      m({ matchNo: 73, roundCode: "R32" }),
    ]);
    expect(sections.map((s) => s.roundCode)).toEqual(["GROUP", "R32", "FINAL"]);
    expect(sections[0].label).toBe("Group stage");
  });

  it("orders matches within a round by match number", () => {
    const sections = buildMatchCenter([
      m({ matchNo: 3, roundCode: "GROUP" }),
      m({ matchNo: 1, roundCode: "GROUP" }),
      m({ matchNo: 2, roundCode: "GROUP" }),
    ]);
    expect(sections[0].matches.map((r) => r.matchNo)).toEqual([1, 2, 3]);
  });

  it("resolves team names from codes and falls back to TBD", () => {
    const [g] = buildMatchCenter([m({ matchNo: 1, roundCode: "GROUP", homeCode: "BRA", awayCode: null })]);
    expect(g.matches[0].home.name).toBe("Brazil");
    expect(g.matches[0].away.name).toBe("TBD");
    expect(g.matches[0].away.code).toBeNull();
  });

  it("derives status: a known winner => FINAL (even over a stale LIVE row), else Result status", () => {
    const [sec] = buildMatchCenter([
      // A recorded winner with a Result stuck at LIVE (missed poll / answer key
      // entered first) is a decided match — it must not render live forever.
      m({ matchNo: 1, roundCode: "GROUP", resultStatus: "LIVE", winnerCode: "MEX" }),
      m({ matchNo: 2, roundCode: "GROUP", winnerCode: "CAN" }),
      m({ matchNo: 3, roundCode: "GROUP" }),
      // Genuinely live: LIVE row, no winner anywhere yet.
      m({ matchNo: 4, roundCode: "GROUP", resultStatus: "LIVE" }),
      // Drawn group match: no winner, but the Result row says FINAL.
      m({ matchNo: 5, roundCode: "GROUP", resultStatus: "FINAL" }),
    ]);
    expect(sec.matches.map((r) => r.status)).toEqual([
      "FINAL",
      "FINAL",
      "SCHEDULED",
      "LIVE",
      "FINAL",
    ]);
  });

  it("serializes scheduledAt to ISO", () => {
    const when = new Date("2026-06-27T19:00:00.000Z");
    const [sec] = buildMatchCenter([m({ matchNo: 73, roundCode: "R32", scheduledAt: when })]);
    expect(sec.matches[0].scheduledAt).toBe("2026-06-27T19:00:00.000Z");
  });

  describe("your-pick marker", () => {
    it("marks a knockout pick correct once the match is decided", () => {
      const [sec] = buildMatchCenter(
        [m({ matchNo: 73, roundCode: "R32", winnerCode: "MEX" })],
        { 73: "MEX" },
      );
      expect(sec.matches[0].yourPick).toEqual({ code: "MEX", name: "Mexico", correct: true });
    });

    it("marks a knockout pick wrong when the winner differs", () => {
      const [sec] = buildMatchCenter(
        [m({ matchNo: 73, roundCode: "R32", winnerCode: "CAN" })],
        { 73: "MEX" },
      );
      expect(sec.matches[0].yourPick?.correct).toBe(false);
    });

    it("leaves correctness null while the match is undecided", () => {
      const [sec] = buildMatchCenter([m({ matchNo: 73, roundCode: "R32" })], { 73: "MEX" });
      expect(sec.matches[0].yourPick?.correct).toBeNull();
    });

    it("never marks a pick on group matches", () => {
      const [sec] = buildMatchCenter([m({ matchNo: 1, roundCode: "GROUP" })], { 1: "MEX" });
      expect(sec.matches[0].yourPick).toBeNull();
    });

    it("never marks a pick on the bronze final (103, unscored)", () => {
      const [sec] = buildMatchCenter([m({ matchNo: 103, roundCode: "BRONZE", winnerCode: "MEX" })], {
        103: "MEX",
      });
      expect(sec.matches[0].yourPick).toBeNull();
    });

    it("omits the marker when the entry made no pick for the match", () => {
      const [sec] = buildMatchCenter([m({ matchNo: 73, roundCode: "R32" })], {});
      expect(sec.matches[0].yourPick).toBeNull();
    });
  });

  it("carries venue and city onto the row", () => {
    const sections = buildMatchCenter([
      {
        matchNo: 1, roundCode: "GROUP", scheduledAt: null,
        homeCode: "MEX", awayCode: "BRA",
        homeScore: null, awayScore: null, winnerCode: null, resultStatus: null,
        venue: "Estadio Azteca", city: "Mexico City",
      },
    ]);
    const row = sections[0].matches[0];
    expect(row.venue).toBe("Estadio Azteca");
    expect(row.city).toBe("Mexico City");
  });
});

describe("orientScorePrediction", () => {
  // Fixture canonical home = GER; pred is GER 3, ECU 0.
  it("keeps the pick as-is when the row matches the fixture orientation", () => {
    expect(orientScorePrediction({ home: 3, away: 0 }, "GER", "ECU", "GER", "ECU")).toEqual({
      home: 3,
      away: 0,
    });
  });

  it("transposes the pick when the row's home/away is flipped vs the fixture", () => {
    // The card shows ECU as home (live Result orientation); the GER 3–0 pick must
    // render as 0–3 so the numbers line up with the labels.
    expect(orientScorePrediction({ home: 3, away: 0 }, "GER", "ECU", "ECU", "GER")).toEqual({
      home: 0,
      away: 3,
    });
  });

  it("falls back to the prediction as-is when a row code is unknown", () => {
    expect(orientScorePrediction({ home: 2, away: 1 }, "NED", "TUN", null, null)).toEqual({
      home: 2,
      away: 1,
    });
  });
});
