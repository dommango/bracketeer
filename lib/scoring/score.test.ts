/* eslint-disable @typescript-eslint/no-explicit-any -- referenceScorePicks below is a verbatim copy of untyped JS from the original tool and must not be altered */
import { describe, it, expect } from "vitest";
import { GROUPS } from "./data";
import { scorePicks } from "./score";
import { parseCsv, csvRowsToSubmission, submissionToCsv } from "./csv";
import { emptyPicks, type Picks, type Results } from "./types";

/* ------------------------------------------------------------------ *
 * Reference oracle: scorePicks copied VERBATIM from the original
 * WorldCup2026Bracket.html. The port in ./score.ts must match this
 * exactly. Keeping the original here lets us diff the two across many
 * randomized inputs — this is the "golden" parity gate.
 * ------------------------------------------------------------------ */
function referenceScorePicks(picks: any, results: any) {
  const breakdown: any = { group: 0, thirds: 0, r32: 0, r16: 0, qf: 0, sf: 0, final: 0, awards: 0 };
  const ROUND_PTS: Record<number, number> = {
    73: 1, 74: 1, 75: 1, 76: 1, 77: 1, 78: 1, 79: 1, 80: 1, 81: 1, 82: 1, 83: 1, 84: 1, 85: 1, 86: 1, 87: 1, 88: 1,
    89: 2, 90: 2, 91: 2, 92: 2, 93: 2, 94: 2, 95: 2, 96: 2,
    97: 3, 98: 3, 99: 3, 100: 3,
    101: 4, 102: 4, 104: 5,
  };
  for (const g of Object.keys(GROUPS)) {
    const p1 = picks.groupFirst?.[g], p2 = picks.groupSecond?.[g];
    const r1 = results.groupFirst?.[g], r2 = results.groupSecond?.[g];
    const rThirds = new Set(results.thirdAdvance || []);
    if (p1 && r1) {
      if (p1 === r1) breakdown.group += 3;
      else if (p1 === r2) breakdown.group += 1;
      else if (rThirds.has(p1)) breakdown.group += 1;
    }
    if (p2 && r2) {
      if (p2 === r2) breakdown.group += 3;
      else if (p2 === r1) breakdown.group += 1;
      else if (rThirds.has(p2)) breakdown.group += 1;
    }
  }
  const pThirds = new Set(picks.thirdAdvance || []);
  const rThirds = new Set(results.thirdAdvance || []);
  for (const t of pThirds) if (rThirds.has(t)) breakdown.thirds += 3;
  for (const [midStr, actualWinner] of Object.entries(results.knockout || {})) {
    const mid = +midStr;
    if (!actualWinner) continue;
    const pts = ROUND_PTS[mid] || 0;
    if (!pts) continue;
    const pickWinner = picks.knockout?.[mid];
    if (pickWinner && pickWinner === actualWinner) {
      if (mid >= 73 && mid <= 88) breakdown.r32 += pts;
      else if (mid >= 89 && mid <= 96) breakdown.r16 += pts;
      else if (mid >= 97 && mid <= 100) breakdown.qf += pts;
      else if (mid === 101 || mid === 102) breakdown.sf += pts;
      else if (mid === 104) breakdown.final += pts;
    }
  }
  const norm = (s: any) => (s || "").trim().toLowerCase();
  for (const k of ["player", "young", "boot", "goal"]) {
    if (norm(picks.awards?.[k]) && norm(picks.awards?.[k]) === norm(results.awards?.[k])) {
      breakdown.awards += 1;
    }
  }
  const total = Object.values(breakdown).reduce((a: number, b: any) => a + b, 0);
  return { total, breakdown };
}

/* ------------------------------------------------------------------ *
 * Deterministic seeded PRNG so the randomized parity test is stable.
 * ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_TEAMS = Object.values(GROUPS).flat();
const KNOCKOUT_IDS = [
  ...Array.from({ length: 16 }, (_, i) => 73 + i), // 73-88
  ...Array.from({ length: 8 }, (_, i) => 89 + i), // 89-96
  97, 98, 99, 100, 101, 102, 103, 104,
];
const AWARD_POOL = ["Messi", "Mbappe", "Haaland", "", "Yamal", "messi "];

function randomPickset(rnd: () => number): Picks {
  const p = emptyPicks();
  for (const [g, teams] of Object.entries(GROUPS)) {
    if (rnd() < 0.9) p.groupFirst[g] = teams[Math.floor(rnd() * teams.length)];
    if (rnd() < 0.9) p.groupSecond[g] = teams[Math.floor(rnd() * teams.length)];
  }
  const nThirds = Math.floor(rnd() * 9);
  const pool = [...ALL_TEAMS];
  for (let i = 0; i < nThirds; i++) {
    const idx = Math.floor(rnd() * pool.length);
    p.thirdAdvance.push(pool.splice(idx, 1)[0]);
  }
  for (const mid of KNOCKOUT_IDS) {
    if (rnd() < 0.7) p.knockout[mid] = ALL_TEAMS[Math.floor(rnd() * ALL_TEAMS.length)];
  }
  p.awards.player = AWARD_POOL[Math.floor(rnd() * AWARD_POOL.length)];
  p.awards.young = AWARD_POOL[Math.floor(rnd() * AWARD_POOL.length)];
  p.awards.boot = AWARD_POOL[Math.floor(rnd() * AWARD_POOL.length)];
  p.awards.goal = AWARD_POOL[Math.floor(rnd() * AWARD_POOL.length)];
  return p;
}

describe("scorePicks — parity with original HTML implementation", () => {
  it("matches the reference across 2000 randomized pick/result pairs", () => {
    const rnd = mulberry32(0xc0ffee);
    for (let n = 0; n < 2000; n++) {
      const picks = randomPickset(rnd);
      const results = randomPickset(rnd) as Results;
      const mine = scorePicks(picks, results);
      const ref = referenceScorePicks(picks, results);
      expect(mine).toEqual(ref);
    }
  });

  it("scores a perfect bracket against itself with the known maximum", () => {
    const rnd = mulberry32(42);
    const answer = randomPickset(rnd) as Results;
    // Score the answer key against itself.
    const { total, breakdown } = scorePicks(answer, answer);
    const ref = referenceScorePicks(answer, answer);
    expect({ total, breakdown }).toEqual(ref);
  });
});

describe("scorePicks — deterministic hand-computed cases", () => {
  const baseResults = (): Results => ({
    ...emptyPicks(),
    groupFirst: { A: "MEX", B: "CAN" },
    groupSecond: { A: "KOR", B: "SUI" },
    thirdAdvance: ["BRA", "USA"],
    knockout: { 73: "MEX", 89: "MEX", 97: "MEX", 101: "MEX", 104: "MEX", 103: "CAN" },
    awards: { player: "Messi", young: "Yamal", boot: "", goal: "Goal" },
  });

  it("awards 3 for exact group position, 1 for swapped position", () => {
    const picks: Picks = {
      ...emptyPicks(),
      groupFirst: { A: "MEX", B: "SUI" }, // A exact (3), B is results' 2nd -> 1
      groupSecond: { A: "KOR" }, // exact (3)
    };
    const { breakdown } = scorePicks(picks, baseResults());
    expect(breakdown.group).toBe(3 + 1 + 3);
  });

  it("awards 1 when a group pick is a correct 3rd-place team", () => {
    const picks: Picks = {
      ...emptyPicks(),
      groupFirst: { A: "BRA" }, // not 1st/2nd of A, but is a results 3rd advancer -> 1
    };
    const { breakdown } = scorePicks(picks, baseResults());
    expect(breakdown.group).toBe(1);
  });

  it("awards 3 per correct third-place advancer", () => {
    const picks: Picks = { ...emptyPicks(), thirdAdvance: ["BRA", "USA", "ARG"] };
    const { breakdown } = scorePicks(picks, baseResults());
    expect(breakdown.thirds).toBe(6); // BRA + USA correct, ARG wrong
  });

  it("uses per-round knockout points and never scores the bronze final (103)", () => {
    const picks: Picks = {
      ...emptyPicks(),
      knockout: { 73: "MEX", 89: "MEX", 97: "MEX", 101: "MEX", 104: "MEX", 103: "CAN" },
    };
    const { breakdown } = scorePicks(picks, baseResults());
    expect(breakdown.r32).toBe(1);
    expect(breakdown.r16).toBe(2);
    expect(breakdown.qf).toBe(3);
    expect(breakdown.sf).toBe(4);
    expect(breakdown.final).toBe(5);
    // 103 matched but is excluded from all buckets.
    expect(breakdown.group + breakdown.thirds).toBe(0);
  });

  it("matches awards case-insensitively and ignores blanks", () => {
    const picks: Picks = {
      ...emptyPicks(),
      awards: { player: "  messi ", young: "YAMAL", boot: "", goal: "" },
    };
    const { breakdown } = scorePicks(picks, baseResults());
    expect(breakdown.awards).toBe(2); // player + young; boot/goal blank on one side
  });
});

describe("CSV round-trip — byte compatibility with exportCsv()", () => {
  it("submission -> CSV -> submission is identity", () => {
    const sub = {
      contestant: { name: "Dom, \"the boss\"", email: "d@x.com", tiebreak: "3" },
      picks: {
        ...emptyPicks(),
        groupFirst: Object.fromEntries(Object.keys(GROUPS).map((g) => [g, GROUPS[g][0]])),
        groupSecond: Object.fromEntries(Object.keys(GROUPS).map((g) => [g, GROUPS[g][1]])),
        thirdAdvance: ["BRA", "USA", "ARG", "ESP", "FRA", "ENG", "POR", "NED"],
        knockout: { 73: "MEX", 104: "ARG" },
        awards: { player: "Messi", young: "Yamal", boot: "Kane", goal: "Bicycle" },
      },
    };
    const csv = submissionToCsv(sub);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // leading BOM preserved
    const back = csvRowsToSubmission(parseCsv(csv));
    expect(back).not.toBeNull();
    expect(back!.contestant).toEqual(sub.contestant);
    expect(back!.picks.groupFirst).toEqual(sub.picks.groupFirst);
    expect(back!.picks.groupSecond).toEqual(sub.picks.groupSecond);
    expect(back!.picks.thirdAdvance).toEqual(sub.picks.thirdAdvance);
    expect(back!.picks.knockout).toEqual({ 73: "MEX", 104: "ARG" });
    expect(back!.picks.awards).toEqual(sub.picks.awards);
  });

  it("strips a UTF-8 BOM and parses accented team names", () => {
    const csv =
      "﻿section,category,key,code,team_or_value,match_date\r\n" +
      "group_stage,Group D,1st,TUR,Türkiye,\r\n" +
      "group_stage,Group E,1st,CIV,Côte d'Ivoire,\r\n";
    const sub = csvRowsToSubmission(parseCsv(csv));
    expect(sub!.picks.groupFirst.D).toBe("TUR");
    expect(sub!.picks.groupFirst.E).toBe("CIV");
  });
});
