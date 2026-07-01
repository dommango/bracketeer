import { describe, it, expect } from "vitest";
import { parseTeamStatistics, type ApiTeamStatistics } from "./team-stats-parse";

const full: ApiTeamStatistics = {
  form: "WWDLW",
  fixtures: {
    played: { total: 5 },
    wins: { total: 3 },
    draws: { total: 1 },
    loses: { total: 1 },
  },
  goals: {
    for: { total: { total: 9 } },
    against: { total: { total: 4 } },
  },
  clean_sheet: { total: 2 },
  failed_to_score: { total: 1 },
};

describe("parseTeamStatistics", () => {
  it("pulls the tournament totals and form string", () => {
    expect(parseTeamStatistics(full)).toEqual({
      played: 5,
      wins: 3,
      draws: 1,
      losses: 1,
      goalsFor: 9,
      goalsAgainst: 4,
      cleanSheets: 2,
      failedToScore: 1,
      form: "WWDLW",
    });
  });

  it("returns null for an empty / not-yet-populated response", () => {
    expect(parseTeamStatistics(null)).toBeNull();
    expect(parseTeamStatistics({})).toBeNull();
    expect(parseTeamStatistics({ fixtures: {} })).toBeNull(); // no games played
  });

  it("coerces missing sub-totals to 0 rather than NaN, and blank form to null", () => {
    const partial: ApiTeamStatistics = { form: "  ", fixtures: { played: { total: 2 } } };
    expect(parseTeamStatistics(partial)).toMatchObject({
      played: 2,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      cleanSheets: 0,
      form: null,
    });
  });
});
