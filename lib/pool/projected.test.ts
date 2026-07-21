import { describe, it, expect } from "vitest";
import { liveLeaders, projectedLivePoints, type LiveResultRow } from "./projected";

const row = (over: Partial<LiveResultRow>): LiveResultRow => ({
  matchNo: 73,
  homeTeamCode: "BRA",
  awayTeamCode: "ARG",
  homeScore: 1,
  awayScore: 0,
  status: "LIVE",
  ...over,
});

describe("liveLeaders", () => {
  it("returns the leading side of a live knockout match", () => {
    expect(liveLeaders([row({})])).toEqual([{ matchNo: 73, leadingCode: "BRA" }]);
    expect(liveLeaders([row({ homeScore: 0, awayScore: 2 })])).toEqual([
      { matchNo: 73, leadingCode: "ARG" },
    ]);
  });

  it("skips ties, missing scores, and non-live rows", () => {
    expect(liveLeaders([row({ awayScore: 1 })])).toEqual([]);
    expect(liveLeaders([row({ homeScore: null })])).toEqual([]);
    expect(liveLeaders([row({ status: "FINAL" })])).toEqual([]);
    expect(liveLeaders([row({ status: "SCHEDULED" })])).toEqual([]);
  });

  it("skips non-knockout matches and missing team codes", () => {
    expect(liveLeaders([row({ matchNo: 50 })])).toEqual([]);
    expect(liveLeaders([row({ homeTeamCode: null })])).toEqual([]);
  });
});

describe("projectedLivePoints", () => {
  it("awards round points to entries whose pick is currently leading", () => {
    const leaders = [
      { matchNo: 73, leadingCode: "BRA" }, // R32 -> 1
      { matchNo: 97, leadingCode: "FRA" }, // QF  -> 3
    ];
    const picks = new Map<string, Record<number, string>>([
      ["e1", { 73: "BRA", 97: "FRA" }],
      ["e2", { 73: "ARG", 97: "FRA" }],
      ["e3", { 73: "ARG" }],
    ]);
    const out = projectedLivePoints(leaders, picks);
    expect(out.get("e1")).toBe(4);
    expect(out.get("e2")).toBe(3);
    expect(out.get("e3")).toBe(0);
  });

  it("never projects the bronze final (match 103 is not scored)", () => {
    const out = projectedLivePoints(
      [{ matchNo: 103, leadingCode: "BRA" }],
      new Map([["e1", { 103: "BRA" }]]),
    );
    expect(out.get("e1")).toBe(0);
  });

  it("respects a custom scoring config", () => {
    const out = projectedLivePoints(
      [{ matchNo: 104, leadingCode: "BRA" }],
      new Map([["e1", { 104: "BRA" }]]),
      { final: 10 },
    );
    expect(out.get("e1")).toBe(10);
  });

  describe("placement-agnostic (flag on)", () => {
    const ON = { knockoutPlacementAgnostic: 1 };

    it("projects a live leader the entry seeded in a different slot", () => {
      // BRA leads match 73 (R32); entry picked BRA to win match 74 (also R32).
      // Slot-based projects nothing; placement-agnostic pays the R32 point.
      const leaders = [{ matchNo: 73, leadingCode: "BRA" }];
      const picks = new Map([["e1", { 74: "BRA" }]]);
      expect(projectedLivePoints(leaders, picks).get("e1") ?? 0).toBe(0);
      expect(projectedLivePoints(leaders, picks, ON).get("e1")).toBe(1);
    });

    it("does not double-pay a round already banked via a decided result", () => {
      // BRA already won R32 (official match 74) — that point is in the actual
      // total. BRA now leads another live R32 (73); projecting it would double it.
      const leaders = [{ matchNo: 73, leadingCode: "BRA" }];
      const picks = new Map([["e1", { 74: "BRA" }]]);
      const official = { 74: "BRA" };
      expect(projectedLivePoints(leaders, picks, ON, official).get("e1")).toBe(0);
    });

    it("counts a leading team once per round even across two live matches", () => {
      const leaders = [
        { matchNo: 73, leadingCode: "BRA" },
        { matchNo: 74, leadingCode: "BRA" },
      ];
      const picks = new Map([["e1", { 75: "BRA" }]]);
      expect(projectedLivePoints(leaders, picks, ON).get("e1")).toBe(1);
    });
  });
});

describe("liveLeaders — decided matches", () => {
  it("skips a LIVE row whose match the answer key already decided", () => {
    // The scored totals already contain a decided match; projecting it again from
    // a Result row the feed hasn't flipped to FINAL would pay it twice.
    expect(liveLeaders([row({})], new Set([73]))).toEqual([]);
  });

  it("still projects live matches the answer key has not decided", () => {
    expect(liveLeaders([row({})], new Set([74]))).toEqual([
      { matchNo: 73, leadingCode: "BRA" },
    ]);
  });
});
