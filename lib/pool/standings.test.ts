import { describe, it, expect } from "vitest";
import { findStandingsConflict } from "./standings";

describe("findStandingsConflict", () => {
  it("accepts well-formed, distinct standings", () => {
    expect(
      findStandingsConflict({
        groupFirst: { A: "MEX", B: "CAN" },
        groupSecond: { A: "RSA", B: "SUI" },
        thirdAdvance: ["KOR", "QAT"],
      }),
    ).toBeNull();
  });

  it("rejects the same team as 1st and 2nd of a group", () => {
    expect(
      findStandingsConflict({
        groupFirst: { A: "MEX" },
        groupSecond: { A: "MEX" },
        thirdAdvance: [],
      }),
    ).toMatch(/both 1st and 2nd/);
  });

  it("rejects a team placed in two different groups", () => {
    expect(
      findStandingsConflict({
        groupFirst: { A: "MEX", B: "MEX" },
        groupSecond: {},
        thirdAdvance: [],
      }),
    ).toMatch(/placed in both/);
  });

  it("rejects a team that is both a runner-up and a third-place advancer", () => {
    expect(
      findStandingsConflict({
        groupFirst: {},
        groupSecond: { A: "RSA" },
        thirdAdvance: ["RSA"],
      }),
    ).toMatch(/placed in both/);
  });

  it("ignores empty slots", () => {
    expect(
      findStandingsConflict({
        groupFirst: { A: "", B: "CAN" },
        groupSecond: { A: "", B: "" },
        thirdAdvance: ["", ""],
      }),
    ).toBeNull();
  });
});
