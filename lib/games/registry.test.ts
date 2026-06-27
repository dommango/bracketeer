// Parity micro-gate for the Phase-0 game-engine seam. Locks the lifted modules to
// the behavior they replaced:
//   - the bracket module's scoreEntries == the scorePicks oracle, and produces NO
//     perPick (bracket ScoreBreakdown shape), and
//   - the MD3 module's scoreEntries scores live results and DOES produce perPick
//     (MD3 ScoreBreakdown shape).
// Together these cover both upsert shapes the orchestrator must preserve.

import { describe, it, expect } from "vitest";
import { gameFor } from "./registry";
import type { ScoringContext } from "./types";
import { scorePicks, DEFAULT_SCORING } from "@/lib/scoring/score";
import { pickRowsToSubmission, submissionToPickRows } from "@/lib/pool/picks";
import { emptyPicks, type Results, type Submission } from "@/lib/scoring/types";
import { md3Fixtures } from "@/lib/pool/match-day-3";

// Bracket scoring never touches the DB, so a bare object stands in for the tx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NO_TX = {} as any;

function ctx(answer: Results): ScoringContext {
  return { tournamentId: "t1", answer, cfg: DEFAULT_SCORING, now: new Date(0) };
}

describe("game registry — bracket parity (no perPick)", () => {
  it("FULL_BRACKET.scoreEntries equals the scorePicks oracle", async () => {
    const sub: Submission = {
      contestant: { name: "T", email: "t@e.com", tiebreak: "3" },
      picks: {
        ...emptyPicks(),
        groupFirst: { A: "BRA", B: "ARG" },
        groupSecond: { A: "CRO", B: "MEX" },
        knockout: { 73: "BRA", 104: "ARG" },
      },
    };
    const rows = submissionToPickRows(sub);
    const answer: Results = {
      ...emptyPicks(),
      groupFirst: { A: "BRA", B: "FRA" },
      groupSecond: { A: "CRO", B: "MEX" },
      knockout: { 73: "BRA", 104: "ARG" },
      finalGoals: null,
    };

    const scored = await gameFor("FULL_BRACKET").scoreEntries(
      NO_TX,
      [{ id: "e1", picks: rows }],
      ctx(answer),
    );
    const ref = scorePicks(pickRowsToSubmission(rows).picks, answer, DEFAULT_SCORING);

    expect(scored).toHaveLength(1);
    expect(scored[0].totalPoints).toBe(ref.total);
    expect(scored[0].byCategory).toEqual(ref.breakdown);
    // Bracket rows must carry NO perPick — the orchestrator relies on this.
    expect(scored[0].perPick).toBeUndefined();
  });

  it("KNOCKOUT module shares the same bracket scoring", async () => {
    const answer: Results = { ...emptyPicks(), knockout: { 73: "BRA" }, finalGoals: null };
    const rows = submissionToPickRows({
      contestant: { name: "", email: "", tiebreak: "" },
      picks: { ...emptyPicks(), knockout: { 73: "BRA" } },
    });
    const scored = await gameFor("KNOCKOUT").scoreEntries(NO_TX, [{ id: "k1", picks: rows }], ctx(answer));
    expect(scored[0].totalPoints).toBe(DEFAULT_SCORING.r32);
    expect(scored[0].perPick).toBeUndefined();
  });
});

describe("game registry — MD3 parity (has perPick)", () => {
  it("scores the live result line and produces perPick", async () => {
    const f = md3Fixtures()[0];
    // Stub tx: loadMd3Results only calls tx.result.findMany.
    const tx = {
      result: {
        findMany: async () => [
          {
            homeTeamCode: f.homeCode,
            awayTeamCode: f.awayCode,
            homeScore: 2,
            awayScore: 1,
            match: { matchNo: f.matchNo },
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const picks = [
      { section: "match_day_3", category: `M${f.matchNo}`, key: "home", code: f.homeCode, teamOrValue: "2" },
      { section: "match_day_3", category: `M${f.matchNo}`, key: "away", code: f.awayCode, teamOrValue: "1" },
    ];

    const scored = await gameFor("MATCH_DAY_3_PICKEM").scoreEntries(
      tx,
      [{ id: "m1", picks }],
      ctx({ ...emptyPicks(), finalGoals: null }),
    );

    expect(scored).toHaveLength(1);
    expect(scored[0].totalPoints).toBe(5); // exact 2–1
    expect(scored[0].perPick).toEqual({ [`M${f.matchNo}`]: 5 });
  });
});
