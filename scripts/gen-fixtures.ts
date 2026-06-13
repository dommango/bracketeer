// Generate a realistic batch of contestant CSV submissions for development &
// testing — the friend group's picks, synthesized. Includes "messy" real-world
// variants (no BOM, LF line endings, partial picks) to harden the importer.
//
// Run with: npx tsx scripts/gen-fixtures.ts
// Output:   fixtures/csv/*.csv

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { submissionToCsv } from "@/lib/scoring/csv";
import { GROUPS, R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";
import { emptyPicks, type Submission } from "@/lib/scoring/types";

const OUT = join(process.cwd(), "fixtures", "csv");
mkdirSync(OUT, { recursive: true });

const groups = Object.keys(GROUPS);
const knockoutMatches = [...R32, ...R16, ...QF, ...SF, FINAL];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a plausible bracket. `chalk` in [0,1]: 1 = always picks the seeded
// favorite (lower index), 0 = uniformly random — yields a realistic score spread.
function buildPicks(rng: () => number, chalk: number): Submission["picks"] {
  const p = emptyPicks();

  for (const g of groups) {
    const teams = GROUPS[g];
    const first = rng() < chalk ? teams[0] : teams[Math.floor(rng() * teams.length)];
    let second = rng() < chalk ? teams[1] : teams[Math.floor(rng() * teams.length)];
    if (second === first) second = teams[(teams.indexOf(first) + 1) % teams.length];
    p.groupFirst[g] = first;
    p.groupSecond[g] = second;
  }

  // Third-place advancers: pick 8 of the not-yet-qualified teams, biased to seeds.
  const candidates: string[] = [];
  for (const g of groups) {
    const taken = new Set([p.groupFirst[g], p.groupSecond[g]]);
    for (const t of GROUPS[g]) if (!taken.has(t)) candidates.push(t);
  }
  // Bias: sort by seed index with noise, take 8.
  const scored = candidates.map((t) => {
    const idx = GROUPS[Object.keys(GROUPS).find((g) => GROUPS[g].includes(t))!].indexOf(t);
    return { t, score: idx + (1 - chalk) * rng() * 4 };
  });
  scored.sort((a, b) => a.score - b.score);
  p.thirdAdvance = scored.slice(0, 8).map((s) => s.t);

  // Knockout: for each match pick one of the seeded favorites at random-ish.
  const favorites = ["BRA", "ARG", "FRA", "ESP", "ENG", "POR", "GER", "NED"];
  for (const m of knockoutMatches) {
    const pool = rng() < chalk ? favorites : groups.map((g) => GROUPS[g][Math.floor(rng() * 4)]);
    p.knockout[m.id] = pool[Math.floor(rng() * pool.length)];
  }

  const players = ["Lamine Yamal", "Vinicius Jr", "Jude Bellingham", "Kylian Mbappe", "Pedri"];
  const youngsters = ["Lamine Yamal", "Endrick", "Arda Guler", "Warren Zaire-Emery"];
  const boots = ["Kylian Mbappe", "Harry Kane", "Vinicius Jr", "Julian Alvarez"];
  p.awards.player = players[Math.floor(rng() * players.length)];
  p.awards.young = youngsters[Math.floor(rng() * youngsters.length)];
  p.awards.boot = boots[Math.floor(rng() * boots.length)];
  p.awards.goal = rng() < 0.5 ? "Some screamer from outside the box" : "";

  return p;
}

interface Person {
  name: string;
  email: string;
  chalk: number;
  tiebreak: string;
  seed: number;
}

const people: Person[] = [
  { name: "Dom Mango", email: "dommango@gmail.com", chalk: 0.85, tiebreak: "3", seed: 1 },
  { name: "Renée O'Brien", email: "renee.obrien@example.com", chalk: 0.7, tiebreak: "2", seed: 2 },
  { name: "José Martínez", email: "jose.m@example.com", chalk: 0.6, tiebreak: "4", seed: 3 },
  { name: "Priya Patel", email: "priya@example.com", chalk: 0.5, tiebreak: "5", seed: 4 },
  { name: "Marcus Lee", email: "marcus.lee@example.com", chalk: 0.4, tiebreak: "2", seed: 5 },
  { name: "Tomás Šimmer", email: "tomas.s@example.com", chalk: 0.3, tiebreak: "1", seed: 6 },
  { name: "Yuki Tanaka", email: "yuki@example.com", chalk: 0.2, tiebreak: "3", seed: 7 },
  { name: "Chaos Carl", email: "carl@example.com", chalk: 0.05, tiebreak: "6", seed: 8 },
];

function safe(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "_");
}

const written: string[] = [];
for (const person of people) {
  const rng = mulberry32(person.seed * 7919);
  const sub: Submission = {
    contestant: { name: person.name, email: person.email, tiebreak: person.tiebreak },
    picks: buildPicks(rng, person.chalk),
  };
  const file = join(OUT, `FWC26_picks_${safe(person.name)}.csv`);
  writeFileSync(file, submissionToCsv(sub), "utf8");
  written.push(file);
}

// --- Messy real-world variants of one contestant ---------------------------
const messyRng = mulberry32(424242);
const messyBase: Submission = {
  contestant: { name: "Messy Max", email: "max@example.com", tiebreak: "2" },
  picks: buildPicks(messyRng, 0.6),
};
const baseCsv = submissionToCsv(messyBase);

// (a) Excel re-save: BOM stripped, LF line endings.
writeFileSync(
  join(OUT, "messy_no_bom_lf.csv"),
  baseCsv.replace(/^﻿/, "").replace(/\r\n/g, "\n"),
  "utf8",
);
written.push(join(OUT, "messy_no_bom_lf.csv"));

// (b) Partial entry: only 5 third-place picks, a couple of group 2nds blank.
const partial: Submission = {
  contestant: { name: "Partial Pam", email: "pam@example.com", tiebreak: "" },
  picks: {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.slice(0, 9).map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: ["BRA", "USA", "ARG", "ESP", "FRA"],
    knockout: { 73: "MEX", 104: "BRA" },
    awards: { player: "Vinicius Jr", young: "", boot: "", goal: "" },
  },
};
writeFileSync(join(OUT, "FWC26_picks_Partial_Pam.csv"), submissionToCsv(partial), "utf8");
written.push(join(OUT, "FWC26_picks_Partial_Pam.csv"));

console.log(`Wrote ${written.length} fixtures to ${OUT}:`);
for (const f of written) console.log("  " + f.replace(process.cwd() + "/", ""));
