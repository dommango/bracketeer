import { describe, it, expect } from "vitest";
import {
  isMd3MatchNo,
  MD3_MATCH_NOS,
  md3Fixtures,
  md3LockAt,
  isMd3MatchLocked,
  revealMd3Fixture,
  isMd3GameOpen,
  lastMd3Kickoff,
  scoreMd3,
} from "./match-day-3";
import { GROUPS, groupMatchups } from "@/lib/scoring/data";
import type { GroupLetter } from "@/lib/scoring/types";
import { kickoffFor } from "@/lib/scoring/schedule";

describe("MD3 match identification", () => {
  it("is exactly the 24 round-3 match numbers", () => {
    expect([...MD3_MATCH_NOS]).toEqual([
      3, 4, 9, 10, 15, 16, 21, 22, 27, 28, 33, 34, 39, 40, 45, 46, 51, 52, 57, 58, 63, 64, 69, 70,
    ]);
    expect(MD3_MATCH_NOS).toHaveLength(24);
    // 2 per group × 12 groups.
    expect(MD3_MATCH_NOS.length).toBe(Object.keys(GROUPS).length * 2);
  });

  it("rejects non-group and out-of-range match numbers", () => {
    expect(isMd3MatchNo(0)).toBe(false);
    expect(isMd3MatchNo(1)).toBe(false); // MD1
    expect(isMd3MatchNo(2)).toBe(false); // MD2 (group A, position 2)
    expect(isMd3MatchNo(73)).toBe(false); // R32 knockout
    expect(isMd3MatchNo(7.5)).toBe(false);
  });

  it("matches the simultaneous-kickoff pair in every group", () => {
    // For each group's 6 matches, the MD3 pair must be the two with the latest
    // (and equal) kickoff — that's the definition of the final round.
    let no = 1;
    for (const letter of Object.keys(GROUPS) as GroupLetter[]) {
      const groupNos = groupMatchups(letter).map(() => no++);
      const md3 = groupNos.filter(isMd3MatchNo);
      expect(md3).toHaveLength(2);
      const [a, b] = md3.map((n) => kickoffFor(n)!.getTime());
      expect(a).toBe(b); // the pair kicks off together
      const others = groupNos.filter((n) => !isMd3MatchNo(n)).map((n) => kickoffFor(n)!.getTime());
      expect(Math.min(a, b)).toBeGreaterThanOrEqual(Math.max(...others));
    }
  });
});

describe("md3Fixtures", () => {
  it("returns 24 fixtures with real teams, in kickoff order", () => {
    const fx = md3Fixtures();
    expect(fx).toHaveLength(24);
    for (const f of fx) {
      expect(GROUPS[f.group]).toContain(f.homeCode);
      expect(GROUPS[f.group]).toContain(f.awayCode);
      expect(f.homeCode).not.toBe(f.awayCode);
      expect(isMd3MatchNo(f.matchNo)).toBe(true);
    }
    const times = fx.map((f) => f.kickoff.getTime());
    expect([...times]).toEqual([...times].sort((a, b) => a - b));
  });

  it("first fixture kicks off 2026-06-24T19:00:00Z", () => {
    expect(md3Fixtures()[0].kickoff.toISOString()).toBe("2026-06-24T19:00:00.000Z");
  });
});

describe("per-match lock", () => {
  it("locks exactly at the fixture's kickoff", () => {
    const at = md3LockAt(9)!;
    expect(at.toISOString()).toBe("2026-06-24T19:00:00.000Z");
    expect(isMd3MatchLocked(9, new Date(at.getTime() - 1000))).toBe(false);
    expect(isMd3MatchLocked(9, at)).toBe(true);
    expect(isMd3MatchLocked(9, new Date(at.getTime() + 1000))).toBe(true);
  });

  it("game is open before the last kickoff, closed after", () => {
    const last = lastMd3Kickoff();
    expect(isMd3GameOpen(new Date(last.getTime() - 1000))).toBe(true);
    expect(isMd3GameOpen(new Date(last.getTime() + 1000))).toBe(false);
  });
});

describe("revealMd3Fixture (hide others' picks until kickoff)", () => {
  const at = md3LockAt(9)!; // 2026-06-24T19:00:00Z
  const before = new Date(at.getTime() - 1000);
  const after = new Date(at.getTime() + 1000);

  it("always reveals the owner's own prediction, before or after kickoff", () => {
    expect(revealMd3Fixture(9, true, before)).toBe(true);
    expect(revealMd3Fixture(9, true, after)).toBe(true);
  });

  it("hides another player's prediction until the fixture kicks off", () => {
    expect(revealMd3Fixture(9, false, before)).toBe(false);
    expect(revealMd3Fixture(9, false, at)).toBe(true);
    expect(revealMd3Fixture(9, false, after)).toBe(true);
  });

  it("is independent per fixture — a later fixture stays hidden while an earlier one opens", () => {
    // Match 9 has kicked off; match 70 (last MD3) has not.
    const last = lastMd3Kickoff();
    const between = new Date(at.getTime() + 1000);
    expect(between.getTime()).toBeLessThan(last.getTime());
    expect(revealMd3Fixture(9, false, between)).toBe(true);
    expect(revealMd3Fixture(70, false, between)).toBe(false);
  });
});

describe("scoreMd3 (5/3/1 ladder)", () => {
  it("exact scoreline = 5", () => {
    expect(scoreMd3({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(5);
    expect(scoreMd3({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(5);
  });

  it("correct result + matching goal difference = 3", () => {
    expect(scoreMd3({ home: 2, away: 1 }, { home: 3, away: 2 })).toBe(3); // home by 1
    expect(scoreMd3({ home: 1, away: 2 }, { home: 0, away: 1 })).toBe(3); // away by 1
    expect(scoreMd3({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(3); // draw, not exact
  });

  it("correct result only = 1", () => {
    expect(scoreMd3({ home: 1, away: 0 }, { home: 3, away: 1 })).toBe(1); // home, diff differs
    expect(scoreMd3({ home: 0, away: 1 }, { home: 1, away: 3 })).toBe(1); // away, diff differs
  });

  it("wrong result = 0", () => {
    expect(scoreMd3({ home: 2, away: 1 }, { home: 0, away: 1 })).toBe(0); // predicted home, away won
    expect(scoreMd3({ home: 1, away: 1 }, { home: 2, away: 0 })).toBe(0); // predicted draw, home won
    expect(scoreMd3({ home: 2, away: 0 }, { home: 1, away: 1 })).toBe(0); // predicted home, draw
  });
});
