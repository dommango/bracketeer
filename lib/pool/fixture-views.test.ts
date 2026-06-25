import { describe, it, expect } from "vitest";
import { sortChrono, byGroupSections, byDaySections, byCityVenues } from "./fixture-views";
import type { MatchCenterRow, MatchCenterSection } from "./match-center";

function row(over: Partial<MatchCenterRow> & { matchNo: number }): MatchCenterRow {
  return {
    roundCode: "GROUP",
    scheduledAt: null,
    status: "SCHEDULED",
    elapsed: null,
    homePens: null,
    awayPens: null,
    home: { code: "AAA", name: "Team A", score: null },
    away: { code: "BBB", name: "Team B", score: null },
    winnerCode: null,
    yourPick: null,
    yourScore: null,
    venue: null,
    city: null,
    cityToken: null,
    odds: null,
    ...over,
  };
}

describe("sortChrono", () => {
  it("orders by kickoff ascending, unscheduled last, ties broken by matchNo", () => {
    const rows = [
      row({ matchNo: 5, scheduledAt: null }),
      row({ matchNo: 2, scheduledAt: "2026-06-12T19:00:00Z" }),
      row({ matchNo: 1, scheduledAt: "2026-06-11T19:00:00Z" }),
      row({ matchNo: 4, scheduledAt: null }),
      row({ matchNo: 3, scheduledAt: "2026-06-12T19:00:00Z" }),
    ];
    expect(sortChrono(rows).map((r) => r.matchNo)).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ matchNo: 2 }), row({ matchNo: 1 })];
    const snapshot = rows.map((r) => r.matchNo);
    sortChrono(rows);
    expect(rows.map((r) => r.matchNo)).toEqual(snapshot);
  });
});

describe("byGroupSections", () => {
  it("attaches a group-<L> anchor and re-sorts matches chronologically", () => {
    const sections: MatchCenterSection[] = [
      {
        roundCode: "GROUP",
        label: "Group A",
        matches: [
          row({ matchNo: 3, scheduledAt: "2026-06-25T19:00:00Z" }),
          row({ matchNo: 1, scheduledAt: "2026-06-11T19:00:00Z" }),
        ],
      },
    ];
    const out = byGroupSections(sections);
    expect(out[0].anchor).toBe("group-A");
    expect(out[0].matches.map((r) => r.matchNo)).toEqual([1, 3]);
  });
});

describe("byDaySections", () => {
  it("buckets into one section per calendar day, chronological, TBD last", () => {
    const rows = [
      row({ matchNo: 3, scheduledAt: null }),
      row({ matchNo: 2, scheduledAt: "2026-06-12T19:00:00Z" }),
      row({ matchNo: 1, scheduledAt: "2026-06-11T19:00:00Z" }),
      row({ matchNo: 4, scheduledAt: "2026-06-12T22:00:00Z" }),
    ];
    const out = byDaySections(rows);
    // Two real days then the TBD bucket.
    expect(out).toHaveLength(3);
    expect(out[0].matches.map((r) => r.matchNo)).toEqual([1]);
    expect(out[1].matches.map((r) => r.matchNo)).toEqual([2, 4]);
    expect(out[2].label).toBe("Date TBD");
    expect(out[2].matches.map((r) => r.matchNo)).toEqual([3]);
  });
});

describe("byCityVenues", () => {
  it("one card per venue, counts games, first-appearance (chrono) order", () => {
    const rows = [
      row({ matchNo: 2, scheduledAt: "2026-06-12T19:00:00Z", cityToken: "boston", city: "Boston", venue: "Gillette Stadium" }),
      row({ matchNo: 1, scheduledAt: "2026-06-11T19:00:00Z", cityToken: "atlanta", city: "Atlanta", venue: "Mercedes-Benz Stadium" }),
      row({ matchNo: 3, scheduledAt: "2026-06-13T19:00:00Z", cityToken: "atlanta", city: "Atlanta", venue: "Mercedes-Benz Stadium" }),
    ];
    const out = byCityVenues(rows);
    expect(out.map((v) => v.token)).toEqual(["atlanta", "boston"]);
    expect(out[0].count).toBe(2);
    expect(out[0].firstKickoff).toBe("2026-06-11T19:00:00Z");
    expect(out[1].count).toBe(1);
  });

  it("skips rows with no cityToken and falls back to HOST_CITIES strings", () => {
    const rows = [
      row({ matchNo: 1, scheduledAt: "2026-06-11T19:00:00Z", cityToken: null }),
      row({ matchNo: 2, scheduledAt: "2026-06-12T19:00:00Z", cityToken: "miami", city: null, venue: null }),
    ];
    const out = byCityVenues(rows);
    expect(out).toHaveLength(1);
    expect(out[0].token).toBe("miami");
    expect(out[0].city).toBe("Miami");
    expect(out[0].venue).toBe("Hard Rock Stadium");
  });
});
