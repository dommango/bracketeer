import { describe, it, expect } from "vitest";
import { GROUPS, groupMatchups, R32_BY_ID } from "@/lib/scoring/data";
import type { GroupLetter, TeamCode } from "@/lib/scoring/types";
import type { GroupResultRow } from "./group-table";
import {
  projectStadiums,
  r32SlotLabel,
  type RemainingMatch,
  type StadiumProjection,
} from "./stadium-projection";

// A decisive home win by `margin` (default 2-0).
const beat = (home: TeamCode, away: TeamCode, margin = 2): GroupResultRow => ({
  homeCode: home,
  awayCode: away,
  homeScore: margin,
  awayScore: 0,
});

// Complete results for one group giving a strict order t0 > t1 > t2 > t3
// (pts 9/6/3/0): each team beats every team below it. `thirdMargin` sets how many
// goals the 3rd-place team (t2) wins its lone match by — varying it per group
// gives the twelve 3rd-place teams distinct goal differences (and thus a strict
// global ordering), so the best-8 selection and slot allocation are deterministic.
function completeGroup(g: GroupLetter, thirdMargin = 2): GroupResultRow[] {
  const [t0, t1, t2, t3] = GROUPS[g];
  return [beat(t0, t1), beat(t0, t2), beat(t0, t3), beat(t1, t2), beat(t1, t3), beat(t2, t3, thirdMargin)];
}

function completeAllGroups(): GroupResultRow[] {
  return (Object.keys(GROUPS) as GroupLetter[]).flatMap((g, i) => completeGroup(g, i + 1));
}

// Find the R32 match + side that hosts a given group placement.
function slotFor(pos: 1 | 2, group: GroupLetter): { matchNo: number; side: "a" | "b" } {
  for (const m of Object.values(R32_BY_ID)) {
    for (const side of ["a", "b"] as const) {
      const s = m[side];
      if (!("third" in s) && s.pos === pos && s.group === group) return { matchNo: m.id, side };
    }
  }
  throw new Error(`no slot for pos ${pos} group ${group}`);
}

const slot = (p: StadiumProjection, side: "a" | "b") => (side === "a" ? p.a : p.b);

describe("r32SlotLabel", () => {
  it("labels winner, runner-up, and third-place slots", () => {
    expect(r32SlotLabel({ pos: 1, group: "A" })).toBe("Winners Group A");
    expect(r32SlotLabel({ pos: 2, group: "B" })).toBe("Runners-up Group B");
    expect(r32SlotLabel({ third: ["A", "B", "C", "D", "F"] })).toBe("3rd place A/B/C/D/F");
  });
});

describe("projectStadiums — fully decided group stage", () => {
  const projections = projectStadiums({ finished: completeAllGroups(), remaining: [], runs: 150 });
  const byMatch = new Map(projections.map((p) => [p.matchNo, p]));

  it("returns one projection per R32 match with its fixed venue", () => {
    expect(projections).toHaveLength(16);
    const m73 = byMatch.get(73)!;
    expect(m73.venue).toBe("SoFi Stadium");
    expect(m73.city).toBe("Los Angeles");
    expect(m73.kickoff).toBe("2026-06-28T19:00:00.000Z");
  });

  it("pins every winner/runner-up slot to the actual finisher (prob 1)", () => {
    for (const g of Object.keys(GROUPS) as GroupLetter[]) {
      const [winner, runnerUp] = GROUPS[g];
      const w = slotFor(1, g);
      const ws = slot(byMatch.get(w.matchNo)!, w.side);
      expect(ws.decided).toBe(true);
      expect(ws.candidates).toHaveLength(1);
      expect(ws.candidates[0].code).toBe(winner);
      expect(ws.candidates[0].prob).toBe(1);

      const r = slotFor(2, g);
      const rs = slot(byMatch.get(r.matchNo)!, r.side);
      expect(rs.candidates[0].code).toBe(runnerUp);
      expect(rs.candidates[0].prob).toBe(1);
    }
  });

  it("seats a single eligible third-place team in every third slot", () => {
    for (const m of Object.values(R32_BY_ID)) {
      for (const side of ["a", "b"] as const) {
        const descriptor = m[side];
        if (!("third" in descriptor)) continue;
        const proj = slot(byMatch.get(m.id)!, side);
        expect(proj.candidates).toHaveLength(1);
        expect(proj.candidates[0].prob).toBe(1);
        // the seated team is a real 3rd-place team from an eligible group
        const teamGroup = (Object.entries(GROUPS).find(([, codes]) =>
          codes.includes(proj.candidates[0].code),
        ) ?? [])[0] as GroupLetter;
        expect(descriptor.third).toContain(teamGroup);
        expect(GROUPS[teamGroup][2]).toBe(proj.candidates[0].code); // index 2 == 3rd
      }
    }
  });

  it("is deterministic for a given state", () => {
    const a = projectStadiums({ finished: completeAllGroups(), remaining: [], runs: 150 });
    const b = projectStadiums({ finished: completeAllGroups(), remaining: [], runs: 150 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("projectStadiums — degenerate & pre-tournament states", () => {
  it("handles a completely empty state without throwing", () => {
    const proj = projectStadiums({ finished: [], remaining: [], runs: 50 });
    expect(proj).toHaveLength(16);
    for (const p of proj) {
      for (const side of [p.a, p.b]) {
        expect(side.decided).toBe(false); // no group has played -> nothing locked
        for (const c of side.candidates) {
          expect(c.prob).toBeGreaterThan(0);
          expect(c.prob).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("pre-tournament (all 72 unplayed, neutral priors): every slot open, probabilities bounded", () => {
    const remaining: RemainingMatch[] = (Object.keys(GROUPS) as GroupLetter[]).flatMap((g) =>
      groupMatchups(g).map(([home, away]) => ({
        homeCode: home,
        awayCode: away,
        homeWinProb: 0.375,
        drawProb: 0.25,
        awayWinProb: 0.375,
      })),
    );
    const proj = projectStadiums({ finished: [], remaining, runs: 400 });
    expect(proj).toHaveLength(16);
    for (const p of proj) {
      for (const side of [p.a, p.b]) {
        expect(side.decided).toBe(false);
        // candidates are a truncated top-K, so the shown mass never exceeds 1
        const mass = side.candidates.reduce((s, c) => s + c.prob, 0);
        expect(mass).toBeLessThanOrEqual(1.0001);
        expect(side.candidates.every((c) => c.prob >= 0 && c.prob <= 1)).toBe(true);
      }
    }
  });
});

describe("projectStadiums — probabilistic group", () => {
  it("ranks a heavy favorite as the most likely group winner", () => {
    // Every group decided except A, whose 6 matches are unplayed. Mexico is a
    // ~90% favorite in each of its matches; the rest are neutral.
    const fav: TeamCode = "MEX";
    const finished = (Object.keys(GROUPS) as GroupLetter[])
      .filter((g) => g !== "A")
      .flatMap(completeGroup);

    const remaining: RemainingMatch[] = groupMatchups("A").map(([home, away]) => {
      if (home === fav) return { homeCode: home, awayCode: away, homeWinProb: 0.9, drawProb: 0.05, awayWinProb: 0.05 };
      if (away === fav) return { homeCode: home, awayCode: away, homeWinProb: 0.05, drawProb: 0.05, awayWinProb: 0.9 };
      return { homeCode: home, awayCode: away, homeWinProb: 0.4, drawProb: 0.2, awayWinProb: 0.4 };
    });

    const projections = projectStadiums({ finished, remaining, runs: 1500 });
    const winnerSlot = slotFor(1, "A");
    const proj = projections.find((p) => p.matchNo === winnerSlot.matchNo)!;
    const ws = slot(proj, winnerSlot.side);

    expect(ws.candidates[0].code).toBe(fav);
    expect(ws.candidates[0].prob).toBeGreaterThan(0.7);
    expect(ws.decided).toBe(false);
  });
});
