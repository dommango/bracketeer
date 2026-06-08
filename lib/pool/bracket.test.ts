import { describe, it, expect } from "vitest";
import { resolveBracket, validateKnockoutWinner } from "./bracket";
import { resolveR32Slots } from "@/lib/scoring/resolve";
import { GROUPS, R32, R16, QF, SF, BRONZE, FINAL } from "@/lib/scoring/data";
import { emptyPicks, type Results } from "@/lib/scoring/types";

const groups = Object.keys(GROUPS);

// Chalk standings: 1st/2nd are teams[0]/[1]; thirds are the 3rd-listed team of
// the first 8 groups (all eligible for some R32 third-slot).
function chalkStandings(): Results {
  return {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
    finalGoals: null,
  };
}

describe("resolveBracket", () => {
  it("R32 home/away match resolve.ts exactly (greedy thirds preserved)", () => {
    const results = chalkStandings();
    const bracket = resolveBracket(results);
    const r32 = resolveR32Slots(results);
    for (const m of R32) {
      expect(bracket[m.id].home).toBe(r32[m.id].a);
      expect(bracket[m.id].away).toBe(r32[m.id].b);
    }
  });

  it("winner is whatever officialResults.knockout records (or null)", () => {
    const results = { ...chalkStandings(), knockout: { 73: GROUPS.A[1] } };
    const bracket = resolveBracket(results);
    expect(bracket[73].winner).toBe(GROUPS.A[1]);
    expect(bracket[74].winner).toBeNull();
  });

  it("propagates winners up the knockout tree (R16/QF/SF/Final feeders)", () => {
    // Give every R32..SF feeder a winner = its home team, so winners chain up.
    const results = chalkStandings();
    const knockout: Record<number, string> = {};
    const base = resolveBracket({ ...results, knockout });
    // Walk rounds in order, always electing the current home team as winner.
    for (const m of R32) knockout[m.id] = base[m.id].home!;
    let b = resolveBracket({ ...results, knockout });
    for (const m of R16) knockout[m.id] = b[m.id].home!;
    b = resolveBracket({ ...results, knockout });
    for (const m of QF) knockout[m.id] = b[m.id].home!;
    b = resolveBracket({ ...results, knockout });
    for (const m of SF) knockout[m.id] = b[m.id].home!;
    b = resolveBracket({ ...results, knockout });

    // Each non-R32 match's home == winner of its 'a' feeder, away == winner of 'b'.
    for (const m of [...R16, ...QF, ...SF]) {
      expect(b[m.id].home).toBe(b[m.a].winner);
      expect(b[m.id].away).toBe(b[m.b].winner);
    }
    // Final feeders are the two semifinals.
    expect(b[FINAL.id].home).toBe(b[FINAL.a].winner);
    expect(b[FINAL.id].away).toBe(b[FINAL.b].winner);
  });

  it("bronze final is contested by the two semifinal losers", () => {
    const results = chalkStandings();
    const knockout: Record<number, string> = {};
    // Resolve enough of the tree that the semifinals have two teams + a winner.
    let b = resolveBracket({ ...results, knockout });
    for (const round of [R32, R16, QF, SF]) {
      for (const m of round) knockout[m.id] = b[m.id].home!;
      b = resolveBracket({ ...results, knockout });
    }
    // SF winners are the home teams; the losers are the away teams.
    expect(b[BRONZE.id].home).toBe(b[SF[0].id].away);
    expect(b[BRONZE.id].away).toBe(b[SF[1].id].away);
  });

  it("unresolved feeders leave downstream slots null", () => {
    const bracket = resolveBracket({ ...emptyPicks(), finalGoals: null });
    // No standings -> R32 slots from groups are null; everything downstream null.
    expect(bracket[89].home).toBeNull();
    expect(bracket[104].home).toBeNull();
    expect(bracket[104].winner).toBeNull();
  });
});

describe("validateKnockoutWinner", () => {
  it("accepts a team that is actually in the match", () => {
    const results = chalkStandings();
    const home = resolveBracket(results)[73].home!;
    expect(validateKnockoutWinner(results, 73, home).ok).toBe(true);
  });

  it("rejects a team not in the (resolved) match", () => {
    const results = chalkStandings();
    const bracket = resolveBracket(results);
    const notInMatch = groups
      .map((g) => GROUPS[g][0])
      .find((t) => t !== bracket[73].home && t !== bracket[73].away)!;
    const res = validateKnockoutWinner(results, 73, notInMatch);
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown team code", () => {
    expect(validateKnockoutWinner(chalkStandings(), 73, "ZZZ").ok).toBe(false);
  });

  it("rejects a non-knockout / out-of-range match number", () => {
    expect(validateKnockoutWinner(chalkStandings(), 1, GROUPS.A[0]).ok).toBe(false);
  });

  it("allows entry when the match teams are not yet resolvable", () => {
    // Final with no feeders resolved: can't disprove, so don't block the admin.
    const res = validateKnockoutWinner({ ...emptyPicks(), finalGoals: null }, 104, GROUPS.A[0]);
    expect(res.ok).toBe(true);
  });
});
