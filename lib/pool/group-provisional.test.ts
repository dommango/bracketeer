import { describe, it, expect } from "vitest";
import { overlayProvisional, provisionalGroupDelta } from "./group-provisional";
import { DEFAULT_SCORING } from "@/lib/scoring/score";
import { emptyPicks, type Results } from "@/lib/scoring/types";

const baseResults = (over: Partial<Results> = {}): Results => ({
  ...emptyPicks(),
  finalGoals: null,
  ...over,
});

describe("overlayProvisional", () => {
  it("keeps an admin-finalized group and fills only un-finalized ones", () => {
    const official = baseResults({ groupFirst: { A: "MEX" }, groupSecond: { A: "RSA" } });
    const provisional = {
      groupFirst: { A: "KOR", B: "CAN" }, // A is official -> ignored; B is new
      groupSecond: { A: "CZE", B: "BIH" },
      thirdAdvance: ["HAI"],
    };
    const out = overlayProvisional(official, provisional);
    expect(out.groupFirst.A).toBe("MEX"); // official wins
    expect(out.groupSecond.A).toBe("RSA");
    expect(out.groupFirst.B).toBe("CAN"); // provisional fills B
    expect(out.groupSecond.B).toBe("BIH");
  });

  it("uses provisional thirds only while official thirds are empty", () => {
    const provisional = { groupFirst: {}, groupSecond: {}, thirdAdvance: ["HAI", "KOR"] };
    expect(overlayProvisional(baseResults(), provisional).thirdAdvance).toEqual(["HAI", "KOR"]);

    const withOfficialThirds = baseResults({ thirdAdvance: ["URU"] });
    expect(overlayProvisional(withOfficialThirds, provisional).thirdAdvance).toEqual(["URU"]);
  });

  it("does not mutate the official object", () => {
    const official = baseResults({ groupFirst: { A: "MEX" } });
    overlayProvisional(official, { groupFirst: { B: "CAN" }, groupSecond: {}, thirdAdvance: [] });
    expect(official.groupFirst).toEqual({ A: "MEX" });
  });
});

describe("provisionalGroupDelta", () => {
  it("returns the group+thirds points the overlay adds", () => {
    const picks = { ...emptyPicks(), groupFirst: { B: "CAN" }, groupSecond: { B: "BIH" } };
    const official = baseResults(); // nothing decided yet
    const overlay = overlayProvisional(official, {
      groupFirst: { B: "CAN" },
      groupSecond: { B: "BIH" },
      thirdAdvance: [],
    });
    // Both picks exact -> 3 + 3 = 6 provisional group points, 0 official.
    expect(provisionalGroupDelta(picks, official, overlay, DEFAULT_SCORING)).toBe(6);
  });

  it("is zero when the overlay adds nothing beyond official", () => {
    const picks = { ...emptyPicks(), groupFirst: { A: "MEX" } };
    const official = baseResults({ groupFirst: { A: "MEX" } });
    const overlay = overlayProvisional(official, { groupFirst: {}, groupSecond: {}, thirdAdvance: [] });
    expect(provisionalGroupDelta(picks, official, overlay, DEFAULT_SCORING)).toBe(0);
  });
});
