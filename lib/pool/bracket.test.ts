import { describe, it, expect } from "vitest";
import {
  resolveBracket,
  validateKnockoutWinner,
  buildKnockoutPairMatchNos,
  mergeThirdAdvance,
  findKnockoutSeatingConflict,
  orientScoresToSlot,
} from "./bracket";
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

describe("buildKnockoutPairMatchNos", () => {
  it("keys each resolved R32 match by its unordered team pair", () => {
    const results = chalkStandings();
    const bracket = resolveBracket(results);
    const pairs = buildKnockoutPairMatchNos(results);
    for (const m of R32) {
      const key = [bracket[m.id].home!, bracket[m.id].away!].sort().join("_");
      expect(pairs.get(key)).toBe(m.id);
    }
  });

  it("is order-independent: home/away swapped resolves to the same match", () => {
    const results = chalkStandings();
    const { home, away } = resolveBracket(results)[73];
    const pairs = buildKnockoutPairMatchNos(results);
    expect(pairs.get([home!, away!].sort().join("_"))).toBe(73);
    expect(pairs.get([away!, home!].sort().join("_"))).toBe(73);
  });

  it("includes later rounds once their feeders have winners, and skips unresolved slots", () => {
    // Give every R32 match a winner (its home) so all 8 R16 matches seat both sides;
    // R16 winners are NOT set, so QF/SF/Final stay unresolved and aren't keyed.
    const bracket0 = resolveBracket(chalkStandings());
    const knockout = Object.fromEntries(R32.map((m) => [m.id, bracket0[m.id].home!]));
    const results: Results = { ...chalkStandings(), knockout };
    const pairs = buildKnockoutPairMatchNos(results);
    const bracket = resolveBracket(results);
    for (const m of R16) {
      expect(pairs.get([bracket[m.id].home!, bracket[m.id].away!].sort().join("_"))).toBe(m.id);
    }
    // Unresolved later rounds aren't keyed.
    expect([...pairs.values()]).not.toContain(FINAL.id);
    expect([...pairs.values()]).not.toContain(QF[0].id);
  });
});

describe("mergeThirdAdvance", () => {
  it("keeps the stored order when the same eight teams are re-submitted", () => {
    const current = ["PAR", "SWE", "ECU", "COD", "BIH", "SEN", "ALG", "GHA"];
    const resubmitted = ["COD", "SWE", "ECU", "GHA", "BIH", "ALG", "PAR", "SEN"];
    // Same set, different order — the order drives R32 seating, so it must not move.
    expect(mergeThirdAdvance(current, resubmitted)).toBe(current);
  });

  it("accepts the submitted list when the set actually changes", () => {
    const current = ["PAR", "SWE", "ECU", "COD", "BIH", "SEN", "ALG", "GHA"];
    const changed = ["PAR", "SWE", "ECU", "COD", "BIH", "SEN", "ALG", "EGY"];
    expect(mergeThirdAdvance(current, changed)).toBe(changed);
    expect(mergeThirdAdvance([], changed)).toBe(changed);
  });
});

describe("findKnockoutSeatingConflict", () => {
  it("is null when every recorded winner sits in its resolved matchup", () => {
    const results = chalkStandings();
    const bracket = resolveBracket(results);
    const knockout = { 73: bracket[73].home!, 74: bracket[74].away! };
    expect(findKnockoutSeatingConflict({ ...results, knockout })).toBeNull();
  });

  it("flags a group-placement edit that unseats a recorded winner", () => {
    const results = chalkStandings();
    // Find the R32 match hosting some group's 1st-place slot, and record that
    // occupant as its winner.
    const g = groups[groups.length - 1]; // a group whose 3rd is NOT in thirdAdvance
    const match = R32.find(
      (m) =>
        ("group" in m.a && m.a.group === g && m.a.pos === 1) ||
        ("group" in m.b && m.b.group === g && m.b.pos === 1),
    )!;
    const winner = results.groupFirst[g];
    const knockout = { [match.id]: winner };
    expect(findKnockoutSeatingConflict({ ...results, knockout })).toBeNull();
    // Re-seat that slot by "correcting" the group's 1st place to a different
    // team: the recorded winner is orphaned from its matchup — flagged.
    const edited = {
      ...results,
      groupFirst: { ...results.groupFirst, [g]: GROUPS[g][3] },
      knockout,
    };
    const conflict = findKnockoutSeatingConflict(edited);
    expect(conflict).toMatch(/not in its resolved matchup/);
  });

  it("ignores matches whose slots are not resolvable yet", () => {
    // A recorded R16 winner with no R32 winners recorded — feeders unresolved, no conflict.
    const results = { ...chalkStandings(), knockout: { [R16[0].id]: GROUPS.A[0] } };
    expect(findKnockoutSeatingConflict(results)).toBeNull();
  });
});

describe("orientScoresToSlot", () => {
  const slot = { home: "MEX", away: "USA" };
  const scores = { homeScore: 1, awayScore: 2, homePens: 5, awayPens: 4 };

  it("passes through when the API home is the bracket home", () => {
    expect(orientScoresToSlot(slot, { ...scores, apiHomeCode: "MEX", apiAwayCode: "USA" })).toEqual(
      scores,
    );
  });

  it("swaps scores AND pens when the API home is the bracket away", () => {
    expect(orientScoresToSlot(slot, { ...scores, apiHomeCode: "USA", apiAwayCode: "MEX" })).toEqual(
      { homeScore: 2, awayScore: 1, homePens: 4, awayPens: 5 },
    );
  });

  it("passes through untouched with no API codes (manual entry) or an unseated slot", () => {
    expect(orientScoresToSlot(slot, scores)).toEqual(scores);
    expect(orientScoresToSlot(undefined, { ...scores, apiHomeCode: "USA" })).toEqual(scores);
    expect(orientScoresToSlot({ home: null, away: null }, { ...scores, apiHomeCode: "USA" })).toEqual(
      scores,
    );
    // API home matches neither seated team — don't guess.
    expect(orientScoresToSlot(slot, { ...scores, apiHomeCode: "BRA" })).toEqual(scores);
  });

  it("normalizes missing fields to null", () => {
    expect(orientScoresToSlot(slot, { apiHomeCode: "USA", apiAwayCode: "MEX", homeScore: 3 })).toEqual(
      { homeScore: null, awayScore: 3, homePens: null, awayPens: null },
    );
  });
});
