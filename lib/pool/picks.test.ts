import { describe, it, expect } from "vitest";
import { submissionToPickRows, pickRowsToSubmission } from "./picks";
import { scorePicks } from "@/lib/scoring/score";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Submission, type Results } from "@/lib/scoring/types";

const sampleSubmission = (): Submission => ({
  contestant: { name: "Alex O'Neil", email: "alex@example.com", tiebreak: "4" },
  picks: {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(Object.keys(GROUPS).map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(Object.keys(GROUPS).map((g) => [g, GROUPS[g][2]])),
    thirdAdvance: ["BRA", "USA", "ARG", "ESP", "FRA", "ENG", "POR", "NED"],
    knockout: { 73: "MEX", 74: "GER", 89: "GER", 104: "ARG" },
    awards: { player: "Messi", young: "Yamal", boot: "Kane", goal: "Scissor kick" },
  },
});

describe("DB Pick row mapping", () => {
  it("submission -> pick rows -> submission preserves picks and contestant", () => {
    const sub = sampleSubmission();
    const rows = submissionToPickRows(sub);
    const back = pickRowsToSubmission(rows, sub.contestant);

    expect(back.contestant).toEqual(sub.contestant);
    expect(back.picks.groupFirst).toEqual(sub.picks.groupFirst);
    expect(back.picks.groupSecond).toEqual(sub.picks.groupSecond);
    expect(back.picks.thirdAdvance).toEqual(sub.picks.thirdAdvance);
    expect(back.picks.knockout).toEqual(sub.picks.knockout);
    expect(back.picks.awards).toEqual(sub.picks.awards);
  });

  it("round-tripped picks score identically to the original", () => {
    const sub = sampleSubmission();
    const answer = sampleSubmission().picks as Results;
    const rows = submissionToPickRows(sub);
    const back = pickRowsToSubmission(rows, sub.contestant);

    expect(scorePicks(back.picks, answer)).toEqual(scorePicks(sub.picks, answer));
  });

  it("emits exactly the expected non-contestant row count", () => {
    const rows = submissionToPickRows(sampleSubmission());
    // 24 group (12 x 1st/2nd) + 8 third slots + 31 knockout (16+8+4+2+1) + 4 awards
    expect(rows.length).toBe(24 + 8 + 31 + 4);
  });
});
