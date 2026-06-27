// Cross-game parity harness — the standing CI gate that locks the GameModule
// abstraction to the behavior it replaced, across the whole input space rather
// than a single fixture (registry.test.ts):
//   - FULL_BRACKET.scoreEntries reproduces the scorePicks oracle, batched, with
//     NO perPick (the bracket ScoreBreakdown shape the orchestrator relies on);
//   - KNOCKOUT shares the exact same bracket scoring;
//   - MATCH_DAY_3_PICKEM group-only is byte-identical to the legacy MD3 breakdown;
//   - compareForRank is a label-free ranking comparator (total, then the MD3
//     quality tiebreak), so leaderboard ranks can never silently diverge.
// If any module is later "optimized" off its reference, this fails.

import { describe, it, expect } from "vitest";
import { gameFor } from "./registry";
import type { GamePickRow, RankRow, ScoringContext } from "./types";
import { GROUPS } from "@/lib/scoring/data";
import { scorePicks, DEFAULT_SCORING } from "@/lib/scoring/score";
import { pickRowsToSubmission, submissionToPickRows } from "@/lib/pool/picks";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";
import { computeMd3Breakdowns } from "@/lib/pool/md3-scoring";
import { md3Fixtures } from "@/lib/pool/match-day-3";
import { knockoutR32Seed } from "@/lib/pool/knockout";
import { resolveAdvance, type AdvanceMap } from "@/lib/pool/knockout-advance";
import { scoredKnockoutNumbers } from "@/lib/pool/pick-form";
import type { Md3Tiebreak } from "@/lib/challenge/md3-tiebreak";

// Bracket scoring never touches the DB, so a bare object stands in for the tx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NO_TX = {} as any;

function ctx(answer: Results): ScoringContext {
  return { tournamentId: "t1", answer, cfg: DEFAULT_SCORING, now: new Date(0) };
}

// Deterministic seeded PRNG (mulberry32) — same family as the oracle test, so the
// randomized parity sweep is stable across runs.
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
  ...Array.from({ length: 16 }, (_, i) => 73 + i),
  ...Array.from({ length: 8 }, (_, i) => 89 + i),
  97, 98, 99, 100, 101, 102, 104,
];
const AWARD_POOL = ["Messi", "Mbappe", "Haaland", "", "Yamal"];

function randomPickset(rnd: () => number): Picks {
  const p = emptyPicks();
  for (const [g, teams] of Object.entries(GROUPS)) {
    if (rnd() < 0.9) p.groupFirst[g] = teams[Math.floor(rnd() * teams.length)];
    if (rnd() < 0.9) p.groupSecond[g] = teams[Math.floor(rnd() * teams.length)];
  }
  const pool = [...ALL_TEAMS];
  const nThirds = Math.floor(rnd() * 9);
  for (let i = 0; i < nThirds; i++) {
    p.thirdAdvance.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
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

// A bracket entry as the module scores it: its pick rows (no positional
// AdvanceMap, so scoring flows straight from the rows like a CSV/full entry).
function bracketEntry(id: string, picks: Picks) {
  const rows = submissionToPickRows({
    contestant: { name: id, email: `${id}@e.com`, tiebreak: "0" },
    picks,
  });
  return { id, picks: rows };
}

// A fully-seated answer key: every group decided + 8 third-place advancers, so
// knockoutR32Seed produces a complete 16-match seed the positional AdvanceMap can
// resolve against. knockout winners are filled below from a fixed "official" map.
function completeAnswer(): Results {
  const a = { ...emptyPicks(), finalGoals: null } as Results;
  for (const [g, teams] of Object.entries(GROUPS)) {
    a.groupFirst[g] = teams[0];
    a.groupSecond[g] = teams[1];
  }
  a.thirdAdvance = Object.keys(GROUPS).slice(0, 8).map((g) => GROUPS[g][2]);
  return a;
}

function randomAdvance(rnd: () => number): AdvanceMap {
  return Object.fromEntries(
    scoredKnockoutNumbers().map((n) => [n, rnd() < 0.5 ? "a" : "b"]),
  ) as AdvanceMap;
}

// Stub tx: the MD3 group + knockout result loaders only call tx.result.findMany.
function stubTx(rows: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { result: { findMany: async () => rows } } as any;
}

describe("parity — FULL_BRACKET module reproduces the scorePicks oracle", () => {
  it("matches scorePicks across 500 randomized entry/answer pairs (no perPick)", async () => {
    const rnd = mulberry32(0xbada55);
    for (let n = 0; n < 500; n++) {
      const answer = randomPickset(rnd) as Results;
      const entry = bracketEntry(`e${n}`, randomPickset(rnd));
      const scored = await gameFor("FULL_BRACKET").scoreEntries(NO_TX, [entry], ctx(answer));
      // Reference: scorePicks on exactly the picks the module decodes from the rows.
      const ref = scorePicks(pickRowsToSubmission(entry.picks).picks, answer, DEFAULT_SCORING);

      expect(scored).toHaveLength(1);
      expect(scored[0].entryId).toBe(entry.id);
      expect(scored[0].totalPoints).toBe(ref.total);
      expect(scored[0].byCategory).toEqual(ref.breakdown);
      // The orchestrator must never write a perPick for bracket rows.
      expect(scored[0].perPick).toBeUndefined();
    }
  });

  it("scores a batch of entries independently and in order", async () => {
    const rnd = mulberry32(7);
    const answer = randomPickset(rnd) as Results;
    const entries = Array.from({ length: 12 }, (_, i) => bracketEntry(`b${i}`, randomPickset(rnd)));
    const scored = await gameFor("FULL_BRACKET").scoreEntries(NO_TX, entries, ctx(answer));

    expect(scored.map((s) => s.entryId)).toEqual(entries.map((e) => e.id));
    for (const entry of entries) {
      const ref = scorePicks(pickRowsToSubmission(entry.picks).picks, answer, DEFAULT_SCORING);
      expect(scored.find((s) => s.entryId === entry.id)!.totalPoints).toBe(ref.total);
    }
  });
});

describe("parity — positional knockoutAdvance resolves against the official seed", () => {
  it("matches scorePicks over the resolved bracket across 100 random advance maps", async () => {
    const rnd = mulberry32(0x5eed);
    // Fixed "official" outcome (advance the a-side everywhere) gives non-zero
    // knockout results to score the resolved picks against — so a regression that
    // skipped resolveAdvance (scoring raw rows instead) would actually diverge.
    const officialAdvance = Object.fromEntries(
      scoredKnockoutNumbers().map((n) => [n, "a"]),
    ) as AdvanceMap;

    for (let n = 0; n < 100; n++) {
      const answer = completeAnswer();
      const seed = knockoutR32Seed(answer);
      answer.knockout = resolveAdvance(officialAdvance, seed);

      const advance = randomAdvance(rnd);
      const entry = { ...bracketEntry(`a${n}`, randomPickset(rnd)), knockoutAdvance: advance };

      const scored = await gameFor("FULL_BRACKET").scoreEntries(NO_TX, [entry], ctx(answer));
      // Reference: the module must resolve the AdvanceMap against knockoutR32Seed
      // of the SAME answer and score that, leaving group/award picks untouched.
      const base = pickRowsToSubmission(entry.picks).picks;
      const ref = scorePicks({ ...base, knockout: resolveAdvance(advance, seed) }, answer, DEFAULT_SCORING);

      expect(scored[0].totalPoints).toBe(ref.total);
      expect(scored[0].byCategory).toEqual(ref.breakdown);
      expect(scored[0].perPick).toBeUndefined();
    }
  });
});

describe("parity — KNOCKOUT shares the exact bracket scoring", () => {
  it("uses the same scoreEntries function as FULL_BRACKET", () => {
    expect(gameFor("KNOCKOUT").scoreEntries).toBe(gameFor("FULL_BRACKET").scoreEntries);
  });

  it("produces identical breakdowns to FULL_BRACKET on the same entry", async () => {
    const rnd = mulberry32(0xfeed);
    for (let n = 0; n < 50; n++) {
      const answer = randomPickset(rnd) as Results;
      const entry = bracketEntry(`k${n}`, randomPickset(rnd));
      const full = await gameFor("FULL_BRACKET").scoreEntries(NO_TX, [entry], ctx(answer));
      const ko = await gameFor("KNOCKOUT").scoreEntries(NO_TX, [entry], ctx(answer));
      expect(ko).toEqual(full);
    }
  });
});

describe("parity — MATCH_DAY_3_PICKEM group-only is byte-identical to legacy MD3", () => {
  it("equals computeMd3Breakdowns for a group entry", async () => {
    const f = md3Fixtures()[0];
    const tx = stubTx([
      { homeTeamCode: f.homeCode, awayTeamCode: f.awayCode, homeScore: 2, awayScore: 1, match: { matchNo: f.matchNo } },
    ]);
    const picks = [
      { section: "match_day_3", category: `M${f.matchNo}`, key: "home", code: f.homeCode, teamOrValue: "2" },
      { section: "match_day_3", category: `M${f.matchNo}`, key: "away", code: f.awayCode, teamOrValue: "1" },
    ];
    const entry = { id: "g1", picks };

    const viaModule = await gameFor("MATCH_DAY_3_PICKEM").scoreEntries(
      tx,
      [entry],
      ctx({ ...emptyPicks(), finalGoals: null }),
    );
    const legacy = await computeMd3Breakdowns(tx, [entry], "t1");

    // The module folds in the (empty) knockout contribution but must return the
    // SAME object as the legacy group path for a group-only entry.
    expect(viaModule[0]).toEqual(legacy[0]);
    expect(viaModule[0].perPick).toEqual({ [`M${f.matchNo}`]: 5 });
  });

  it("equals computeMd3Breakdowns across 50 randomized multi-fixture group entries", async () => {
    const rnd = mulberry32(0xda11);
    const fixtures = md3Fixtures();
    for (let n = 0; n < 50; n++) {
      const picks: GamePickRow[] = [];
      const resultRows: unknown[] = [];
      for (const f of fixtures) {
        if (rnd() < 0.4) continue; // a random subset of fixtures predicted + played
        const ph = Math.floor(rnd() * 4);
        const pa = Math.floor(rnd() * 4);
        picks.push(
          { section: "match_day_3", category: `M${f.matchNo}`, key: "home", code: f.homeCode, teamOrValue: String(ph) },
          { section: "match_day_3", category: `M${f.matchNo}`, key: "away", code: f.awayCode, teamOrValue: String(pa) },
        );
        resultRows.push({
          homeTeamCode: f.homeCode,
          awayTeamCode: f.awayCode,
          homeScore: Math.floor(rnd() * 4),
          awayScore: Math.floor(rnd() * 4),
          match: { matchNo: f.matchNo },
        });
      }
      if (picks.length === 0) continue;
      const tx = stubTx(resultRows);
      const entry = { id: `m${n}`, picks };
      const viaModule = await gameFor("MATCH_DAY_3_PICKEM").scoreEntries(
        tx,
        [entry],
        ctx({ ...emptyPicks(), finalGoals: null }),
      );
      const legacy = await computeMd3Breakdowns(tx, [entry], "t1");
      expect(viaModule[0]).toEqual(legacy[0]);
    }
  });
});

describe("parity — compareForRank is a label-free ranking comparator", () => {
  const TB = (o: Partial<Md3Tiebreak>): Md3Tiebreak => ({ exact: 0, gd: 0, result: 0, goalDelta: 0, ...o });

  for (const format of ["FULL_BRACKET", "KNOCKOUT", "MATCH_DAY_3_PICKEM"] as const) {
    const cmp = gameFor(format).compareForRank;

    it(`${format}: higher total ranks ahead; identical rows tie; order flips on swap`, () => {
      const hi: RankRow = { total: 10, label: "zzz" };
      const lo: RankRow = { total: 3, label: "aaa" };
      expect(cmp(hi, lo)).toBeLessThan(0);
      expect(cmp(lo, hi)).toBeGreaterThan(0); // sign flips when arguments swap
      expect(cmp(hi, hi)).toBe(0); // self-comparison is a dead heat
    });

    it(`${format}: label never affects the rank`, () => {
      const a: RankRow = { total: 5, label: "aaa" };
      const b: RankRow = { total: 5, label: "zzz" };
      // Same total, no tiebreak vector → a genuine dead heat regardless of label.
      expect(cmp(a, b)).toBe(0);
    });
  }

  it("FULL_BRACKET ignores any MD3 tiebreak vector (total-only)", () => {
    const cmp = gameFor("FULL_BRACKET").compareForRank;
    const a: RankRow = { total: 5, md3Tiebreak: TB({ exact: 9 }) };
    const b: RankRow = { total: 5, md3Tiebreak: TB({ exact: 0 }) };
    expect(cmp(a, b)).toBe(0);
  });

  it("MATCH_DAY_3_PICKEM breaks equal totals by the quality cascade", () => {
    const cmp = gameFor("MATCH_DAY_3_PICKEM").compareForRank;
    const more: RankRow = { total: 5, md3Tiebreak: TB({ exact: 2 }) };
    const fewer: RankRow = { total: 5, md3Tiebreak: TB({ exact: 1 }) };
    expect(cmp(more, fewer)).toBeLessThan(0); // more exact scorelines ranks ahead
    // Higher total still wins outright, tiebreak notwithstanding.
    const lowTotalHighQuality: RankRow = { total: 4, md3Tiebreak: TB({ exact: 9 }) };
    expect(cmp(more, lowTotalHighQuality)).toBeLessThan(0);
  });
});
