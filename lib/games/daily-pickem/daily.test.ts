// Daily pick'em knockout engine — pure rules + the additive scoring, and the
// critical regression that a group-only entry scores byte-identically to the legacy
// Match Day Pickem path after the knockout extension.

import { describe, it, expect } from "vitest";
import { DAILY_KNOCKOUT_MATCH_NOS, DAILY_MATCH_NOS, isDailyKnockoutMatchNo } from "./scope";
import { scoreDailyKnockout } from "./score-knockout";
import { subBoardsFromPerPick, groupSubBoard } from "./subboards";
import { knockoutDailyFixtures } from "./fixtures";
import { computeDailyBreakdowns, computeDailyKnockout } from "./score-entries";
import { computeMd3Breakdowns } from "@/lib/pool/md3-scoring";
import { md3Fixtures } from "@/lib/pool/match-day-3";
import { emptyPicks, type Results } from "@/lib/scoring/types";
import type { ScoringContext } from "@/lib/games/types";

function ctx(answer: Results, tournamentId = "t1"): ScoringContext {
  return { tournamentId, answer, cfg: {} as ScoringContext["cfg"], now: new Date(0) };
}

describe("daily scope", () => {
  it("covers 31 scored knockout matches, excludes bronze 103", () => {
    expect(DAILY_KNOCKOUT_MATCH_NOS).toHaveLength(31);
    expect(DAILY_KNOCKOUT_MATCH_NOS).not.toContain(103);
    expect(DAILY_KNOCKOUT_MATCH_NOS).toContain(73);
    expect(DAILY_KNOCKOUT_MATCH_NOS).toContain(104);
    expect(isDailyKnockoutMatchNo(73)).toBe(true);
    expect(isDailyKnockoutMatchNo(103)).toBe(false);
    expect(isDailyKnockoutMatchNo(9)).toBe(false);
  });

  it("daily span = 24 group fixtures + 31 knockouts", () => {
    expect(DAILY_MATCH_NOS).toHaveLength(24 + 31);
  });
});

describe("scoreDailyKnockout", () => {
  const base = { homeCode: "BRA", awayCode: "ARG", winnerCode: "BRA" as string | null };

  it("exact line + advancement bonus when winner matches", () => {
    const r = scoreDailyKnockout({ ...base, predByTeam: { BRA: 2, ARG: 1 }, actual: { home: 2, away: 1 } });
    expect(r.line).toBe(5);
    expect(r.bonus).toBe(1);
    expect(r.points).toBe(6);
  });

  it("right result + GD scores 3 on the line, plus bonus", () => {
    const r = scoreDailyKnockout({ ...base, predByTeam: { BRA: 3, ARG: 2 }, actual: { home: 2, away: 1 } });
    expect(r.line).toBe(3);
    expect(r.bonus).toBe(1);
    expect(r.points).toBe(4);
  });

  it("wrong result scores 0 and no bonus (predicted winner differs)", () => {
    const r = scoreDailyKnockout({ ...base, predByTeam: { BRA: 0, ARG: 2 }, actual: { home: 2, away: 1 } });
    expect(r.line).toBe(0);
    expect(r.bonus).toBe(0);
    expect(r.points).toBe(0);
  });

  it("predicted draw infers no winner → no bonus even if line scores", () => {
    // predicted 1–1, actual 2–2: both draws, matching GD → line 3, but no inferred winner.
    const r = scoreDailyKnockout({ ...base, predByTeam: { BRA: 1, ARG: 1 }, actual: { home: 2, away: 2 } });
    expect(r.line).toBe(3);
    expect(r.bonus).toBe(0);
    expect(r.points).toBe(3);
  });

  it("correct line but the other team actually advanced → line scores, no bonus", () => {
    const r = scoreDailyKnockout({ ...base, winnerCode: "ARG", predByTeam: { BRA: 2, ARG: 1 }, actual: { home: 2, away: 1 } });
    expect(r.line).toBe(5);
    expect(r.bonus).toBe(0);
  });
});

describe("subBoardsFromPerPick", () => {
  it("buckets per-pick points by stage and sums overall", () => {
    const perPick = { M9: 5, M16: 1, M73: 3, M89: 2, M104: 6, M103: 9 /* unscored, ignored */ };
    const { byStage, overall } = subBoardsFromPerPick(perPick);
    expect(byStage.GROUP).toBe(6); // 5 + 1
    expect(byStage.R32).toBe(3);
    expect(byStage.R16).toBe(2);
    expect(byStage.FINAL).toBe(6);
    expect(overall).toBe(17); // bronze M103 excluded
    expect(groupSubBoard(perPick)).toBe(6);
  });

  it("handles empty / null perPick", () => {
    expect(subBoardsFromPerPick(null).overall).toBe(0);
    expect(subBoardsFromPerPick({}).byStage.GROUP).toBe(0);
  });
});

describe("knockoutDailyFixtures", () => {
  it("returns 31 fixtures, all closed with empty results", () => {
    const fx = knockoutDailyFixtures({ ...emptyPicks(), finalGoals: null });
    expect(fx).toHaveLength(31);
    expect(fx.every((f) => f.open === false)).toBe(true);
  });

  it("resolves a downstream fixture from official feeder winners", () => {
    // R16 match 89 feeds off R32 matches 74 and 77.
    const results: Results = { ...emptyPicks(), knockout: { 74: "BRA", 77: "ARG", 89: "BRA" }, finalGoals: null };
    const fx = knockoutDailyFixtures(results).find((f) => f.matchNo === 89)!;
    expect(fx.homeCode).toBe("BRA");
    expect(fx.awayCode).toBe("ARG");
    expect(fx.open).toBe(true);
    expect(fx.stage).toBe("R16");
  });
});

describe("computeDailyKnockout / computeDailyBreakdowns", () => {
  // Stub tx: both the group and knockout result loaders only call tx.result.findMany.
  function stubTx(rows: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { result: { findMany: async () => rows } } as any;
  }

  it("scores a knockout pick: exact line + advancement bonus", async () => {
    const answer: Results = { ...emptyPicks(), knockout: { 74: "BRA", 77: "ARG", 89: "BRA" }, finalGoals: null };
    const tx = stubTx([
      { homeTeamCode: "BRA", awayTeamCode: "ARG", homeScore: 2, awayScore: 1, match: { matchNo: 89 } },
    ]);
    const picks = [
      { section: "daily_knockout", category: "M89", key: "home", code: "BRA", teamOrValue: "2" },
      { section: "daily_knockout", category: "M89", key: "away", code: "ARG", teamOrValue: "1" },
    ];
    const ko = await computeDailyKnockout(tx, [{ id: "e1", picks }], ctx(answer));
    expect(ko[0]).toEqual({ entryId: "e1", total: 6, perPick: { M89: 6 } });

    const merged = await computeDailyBreakdowns(tx, [{ id: "e1", picks }], ctx(answer));
    expect(merged[0].totalPoints).toBe(6);
    expect(merged[0].perPick).toEqual({ M89: 6 });
    expect((merged[0].byCategory as Record<string, unknown>).daily).toBe(6);
  });

  it("a group-only entry is byte-identical to the legacy MD3 breakdown", async () => {
    const f = md3Fixtures()[0];
    const tx = stubTx([
      { homeTeamCode: f.homeCode, awayTeamCode: f.awayCode, homeScore: 2, awayScore: 1, match: { matchNo: f.matchNo } },
    ]);
    const picks = [
      { section: "match_day_3", category: `M${f.matchNo}`, key: "home", code: f.homeCode, teamOrValue: "2" },
      { section: "match_day_3", category: `M${f.matchNo}`, key: "away", code: f.awayCode, teamOrValue: "1" },
    ];
    const legacy = await computeMd3Breakdowns(tx, [{ id: "g1", picks }], "t1");
    const daily = await computeDailyBreakdowns(tx, [{ id: "g1", picks }], ctx({ ...emptyPicks(), finalGoals: null }));

    expect(legacy[0].totalPoints).toBe(5);
    // The daily path must return the SAME object shape — no daily key, same perPick.
    expect(daily[0]).toEqual(legacy[0]);
  });
});
