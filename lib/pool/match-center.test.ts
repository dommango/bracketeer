import { describe, it, expect } from "vitest";
import { buildMatchCenter, type MatchInput } from "./match-center";

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

  it("derives status: Result status wins, else winner => FINAL, else SCHEDULED", () => {
    const [sec] = buildMatchCenter([
      m({ matchNo: 1, roundCode: "GROUP", resultStatus: "LIVE", winnerCode: "MEX" }),
      m({ matchNo: 2, roundCode: "GROUP", winnerCode: "CAN" }),
      m({ matchNo: 3, roundCode: "GROUP" }),
    ]);
    expect(sec.matches.map((r) => r.status)).toEqual(["LIVE", "FINAL", "SCHEDULED"]);
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
