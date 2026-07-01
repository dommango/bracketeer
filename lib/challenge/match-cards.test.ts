import { describe, it, expect } from "vitest";
import { buildScoreCardInputs } from "./match-cards";
import type { MatchInput } from "@/lib/pool/match-center";

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

const NOW = new Date("2026-06-26T12:00:00.000Z");

describe("buildScoreCardInputs", () => {
  it("collects LIVE rows into `live`", () => {
    const { live } = buildScoreCardInputs(
      [
        m({ matchNo: 33, roundCode: "GROUP", homeCode: "MEX", awayCode: "BRA", resultStatus: "LIVE" }),
        m({ matchNo: 34, roundCode: "GROUP", homeCode: "CAN", awayCode: "USA", resultStatus: "SCHEDULED" }),
      ],
      {},
      NOW,
    );
    expect(live.map((r) => r.matchNo)).toEqual([33]);
  });

  it("picks the latest-scheduled FINAL as `last`", () => {
    const { last } = buildScoreCardInputs(
      [
        m({
          matchNo: 33,
          roundCode: "GROUP",
          resultStatus: "FINAL",
          winnerCode: "MEX",
          scheduledAt: new Date("2026-06-24T19:00:00.000Z"),
        }),
        m({
          matchNo: 34,
          roundCode: "GROUP",
          resultStatus: "FINAL",
          winnerCode: "CAN",
          scheduledAt: new Date("2026-06-25T19:00:00.000Z"),
        }),
      ],
      {},
      NOW,
    );
    expect(last?.matchNo).toBe(34);
  });

  it("selects the soonest upcoming unscored match as `next`", () => {
    const { next } = buildScoreCardInputs(
      [
        m({
          matchNo: 33,
          roundCode: "GROUP",
          homeCode: "MEX",
          awayCode: "BRA",
          scheduledAt: new Date("2026-06-27T19:00:00.000Z"),
        }),
        m({
          matchNo: 34,
          roundCode: "GROUP",
          homeCode: "CAN",
          awayCode: "USA",
          scheduledAt: new Date("2026-06-28T19:00:00.000Z"),
        }),
      ],
      {},
      NOW,
    );
    expect(next?.matchNo).toBe(33);
    expect(next?.home).toBe("MEX");
    expect(next?.away).toBe("BRA");
  });

  it("annotates a knockout pick onto the next card", () => {
    const { next } = buildScoreCardInputs(
      [m({ matchNo: 73, roundCode: "R32", homeCode: "MEX", awayCode: "BRA", scheduledAt: new Date("2026-06-29T19:00:00.000Z") })],
      { 73: "MEX" },
      NOW,
    );
    expect(next?.yourPick).toEqual({ code: "MEX", name: "Mexico" });
  });

  it("drops a stuck-LIVE match (kickoff long past) off `live` and surfaces it as `last`", () => {
    const { live, last } = buildScoreCardInputs(
      [
        m({
          matchNo: 73,
          roundCode: "R32",
          homeCode: "MEX",
          awayCode: "BRA",
          resultStatus: "LIVE",
          homeScore: 1,
          awayScore: 0,
          // ~18h before NOW — a match can't still be live this long after kickoff.
          scheduledAt: new Date("2026-06-25T18:00:00.000Z"),
        }),
      ],
      {},
      NOW,
    );
    expect(live).toEqual([]);
    expect(last?.matchNo).toBe(73);
    expect(last?.status).toBe("FINAL");
  });

  it("keeps a recently-kicked-off LIVE match on `live`", () => {
    const { live } = buildScoreCardInputs(
      [
        m({
          matchNo: 73,
          roundCode: "R32",
          homeCode: "MEX",
          awayCode: "BRA",
          resultStatus: "LIVE",
          // 1h before NOW — still plausibly in play.
          scheduledAt: new Date("2026-06-26T11:00:00.000Z"),
        }),
      ],
      {},
      NOW,
    );
    expect(live.map((r) => r.matchNo)).toEqual([73]);
  });

  it("does not pick a stuck-LIVE match as `next` via the fallback", () => {
    const { next } = buildScoreCardInputs(
      [
        m({
          matchNo: 73,
          roundCode: "R32",
          homeCode: "MEX",
          awayCode: "BRA",
          resultStatus: "LIVE",
          scheduledAt: new Date("2026-06-25T18:00:00.000Z"),
        }),
      ],
      {},
      NOW,
    );
    expect(next).toBeNull();
  });

  it("returns nulls when everything is already decided", () => {
    const { live, next } = buildScoreCardInputs(
      [m({ matchNo: 33, roundCode: "GROUP", resultStatus: "FINAL", winnerCode: "MEX" })],
      {},
      NOW,
    );
    expect(live).toEqual([]);
    expect(next).toBeNull();
  });
});
