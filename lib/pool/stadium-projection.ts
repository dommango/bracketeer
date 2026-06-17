// Stadium projection — "which teams are likely to play at which stadium" in the
// Round of 32. Pure and DB-free (the prisma side, getStadiumProjections, lives in
// queries.ts), so it's unit-testable.
//
// R32 venues are FIXED by the schedule (match 73 is always SoFi/LA, etc.) and each
// R32 slot is defined by a group finish (M73 = runner-up A vs runner-up B). So the
// only unknown is WHO finishes where. We answer that with a Monte Carlo run:
// finished group matches are held fixed; each remaining match is sampled from its
// implied win/draw/loss probabilities; the group is ranked with the live FIFA
// engine (genuine ties broken by random draw-of-lots, mirroring FIFA); the 8 best
// third-place teams are chosen; and resolveR32Slots maps the finishers onto R32
// slots. Tallying slot occupants across many runs gives each team's probability of
// appearing in each R32 match — hence each stadium.
//
// This is display-only analytics: it never touches scorePicks or the answer key.

import { GROUPS, R32, TEAMS, type R32Slot } from "@/lib/scoring/data";
import { venueFor, kickoffFor, type CityToken } from "@/lib/scoring/schedule";
import { resolveR32Slots } from "@/lib/scoring/resolve";
import { emptyPicks, type GroupLetter, type Picks, type TeamCode } from "@/lib/scoring/types";
import { computeGroupTables, type GroupResultRow, type GroupTableRow } from "./group-table";

// One not-yet-played group match with its implied three-way probabilities. The
// query layer supplies a prior for matches without live odds.
export interface RemainingMatch {
  homeCode: TeamCode;
  awayCode: TeamCode;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
}

export interface StadiumProjectionInput {
  finished: GroupResultRow[];
  remaining: RemainingMatch[];
  runs?: number;
  seed?: number;
}

export interface SlotCandidate {
  code: TeamCode;
  name: string;
  prob: number; // 0..1
}

export interface R32SlotProjection {
  label: string; // "Winners Group A", "Runners-up Group B", "3rd place A/B/C/D/F"
  decided: boolean; // true once a single team holds the slot in every run
  candidates: SlotCandidate[]; // sorted desc by prob, capped
}

export interface StadiumProjection {
  matchNo: number; // 73..88
  venue: string;
  city: string;
  cityToken: CityToken;
  kickoff: string | null; // ISO
  a: R32SlotProjection;
  b: R32SlotProjection;
}

const DEFAULT_RUNS = 2000;
const MAX_CANDIDATES = 5;
const GROUP_SIZE = 6; // matches per group (4 teams, round-robin)

const teamName = (code: string): string => TEAMS[code] ?? code;

// code -> group letter, from the static GROUPS map.
const TEAM_GROUP: Record<string, GroupLetter> = (() => {
  const m: Record<string, GroupLetter> = {};
  for (const [g, codes] of Object.entries(GROUPS)) for (const c of codes) m[c] = g as GroupLetter;
  return m;
})();

// The eight R32 sides fed by a third-place team, as (matchNo, side) pairs.
const THIRD_SLOTS: { matchNo: number; side: "a" | "b" }[] = R32.flatMap((m) =>
  (["a", "b"] as const).filter((s) => "third" in m[s]).map((side) => ({ matchNo: m.id, side })),
);

// --- seeded RNG (mulberry32) ------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over a stable serialization of the inputs, so the same tournament state
// yields the same projection across renders (no flicker on refresh).
function deriveSeed(input: StadiumProjectionInput): number {
  const parts: string[] = [];
  for (const r of input.finished) parts.push(`${r.homeCode}${r.awayCode}${r.homeScore}-${r.awayScore}`);
  parts.sort();
  const rem = input.remaining
    .map((m) => `${m.homeCode}${m.awayCode}${m.homeWinProb.toFixed(3)}${m.drawProb.toFixed(3)}`)
    .sort();
  const str = `${parts.join("|")}#${rem.join("|")}#${input.runs ?? DEFAULT_RUNS}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// In-place Fisher-Yates shuffle using the seeded RNG.
function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Sample a plausible scoreline for one remaining match. The outcome (home/draw/
// away) is drawn from the implied probabilities; the goal counts come from a light
// fixed model so goal-difference tiebreaks stay meaningful without needing a
// totals/supremacy market. Heuristic by design — see file header.
function sampleScore(m: RemainingMatch, rng: () => number): { home: number; away: number } {
  const u = rng();
  const loser = pick(rng, [0, 1, 2, 3], [0.45, 0.35, 0.15, 0.05]);
  if (u < m.homeWinProb) {
    const margin = pick(rng, [1, 2, 3, 4], [0.5, 0.3, 0.15, 0.05]);
    return { home: loser + margin, away: loser };
  }
  if (u < m.homeWinProb + m.drawProb) {
    const g = pick(rng, [0, 1, 2, 3], [0.3, 0.45, 0.2, 0.05]);
    return { home: g, away: g };
  }
  const margin = pick(rng, [1, 2, 3, 4], [0.5, 0.3, 0.15, 0.05]);
  return { home: loser, away: loser + margin };
}

function pick<T>(rng: () => number, values: T[], weights: number[]): T {
  const u = rng();
  let acc = 0;
  for (let i = 0; i < values.length; i++) {
    acc += weights[i];
    if (u < acc) return values[i];
  }
  return values[values.length - 1];
}

// Order a finished group's four teams 1st->4th, using the live engine's ranking
// (full FIFA chain incl. head-to-head) and breaking only genuine ties (same rank)
// by random draw-of-lots.
function orderGroup(rows: GroupTableRow[], rng: () => number): GroupTableRow[] {
  const ordered: GroupTableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && rows[j].rank === rows[i].rank) j++;
    const tie = rows.slice(i, j);
    if (tie.length > 1) shuffle(tie, rng);
    ordered.push(...tie);
    i = j;
  }
  return ordered;
}

// Human label for an R32 slot descriptor.
export function r32SlotLabel(slot: R32Slot): string {
  if ("third" in slot) return `3rd place ${slot.third.join("/")}`;
  return slot.pos === 1 ? `Winners Group ${slot.group}` : `Runners-up Group ${slot.group}`;
}

interface SlotCounter {
  total: number;
  byTeam: Map<TeamCode, number>;
}

function emptyCounter(): SlotCounter {
  return { total: 0, byTeam: new Map() };
}

function bump(c: SlotCounter, code: TeamCode | null): void {
  c.total += 1;
  if (code) c.byTeam.set(code, (c.byTeam.get(code) ?? 0) + 1);
}

function toProjection(c: SlotCounter): SlotCandidate[] {
  if (c.total === 0) return [];
  const out: SlotCandidate[] = [];
  for (const [code, n] of c.byTeam) out.push({ code, name: teamName(code), prob: n / c.total });
  out.sort((x, y) => y.prob - x.prob || x.code.localeCompare(y.code));
  return out.slice(0, MAX_CANDIDATES);
}

// Run the Monte Carlo and return one projection per R32 match (73..88).
export function projectStadiums(input: StadiumProjectionInput): StadiumProjection[] {
  const runs = input.runs ?? DEFAULT_RUNS;
  const rng = mulberry32(input.seed ?? deriveSeed(input));

  // counters[matchNo] = { a, b }
  const counters = new Map<number, { a: SlotCounter; b: SlotCounter }>();
  for (const m of R32) counters.set(m.id, { a: emptyCounter(), b: emptyCounter() });

  for (let run = 0; run < runs; run++) {
    const rows: GroupResultRow[] = input.finished.slice();
    for (const m of input.remaining) {
      const s = sampleScore(m, rng);
      rows.push({ homeCode: m.homeCode, awayCode: m.awayCode, homeScore: s.home, awayScore: s.away });
    }

    const tables = computeGroupTables(rows);
    const picks: Picks = emptyPicks();
    const thirds: GroupTableRow[] = [];

    for (const g of Object.keys(GROUPS) as GroupLetter[]) {
      const ordered = orderGroup(tables[g], rng);
      picks.groupFirst[g] = ordered[0].code;
      picks.groupSecond[g] = ordered[1].code;
      thirds.push(ordered[2]);
    }

    // Best 8 of 12 thirds: pts -> GD -> goals, ties broken by lots (random key).
    // Deliberately unlike group-table's selectBestThirds (which drops tie-blocks
    // straddling the cutoff rather than guess): a Monte Carlo run must commit to
    // exactly 8, and resolving ties by lots mirrors FIFA's drawing of lots.
    const keyed = thirds.map((t) => ({ row: t, r: rng() }));
    keyed.sort((x, y) => y.row.pts - x.row.pts || y.row.gd - x.row.gd || y.row.gf - x.row.gf || x.r - y.r);
    picks.thirdAdvance = keyed.slice(0, 8).map((k) => k.row.code);

    const resolved = resolveR32Slots(picks);

    // resolveR32Slots falls back to a non-disjoint first-eligible guess when no
    // full third-place assignment exists for this run's best-8. That guess would
    // bias the third-slot counts, so only tally third slots when the eight came
    // out distinct and fully seated. Winner/runner-up slots are unaffected.
    const seated = THIRD_SLOTS.map((s) => resolved[s.matchNo]?.[s.side] ?? null);
    const thirdsValid = seated.every((t) => t !== null) && new Set(seated).size === THIRD_SLOTS.length;

    for (const m of R32) {
      const c = counters.get(m.id)!;
      if (!("third" in m.a) || thirdsValid) bump(c.a, resolved[m.id]?.a ?? null);
      if (!("third" in m.b) || thirdsValid) bump(c.b, resolved[m.id]?.b ?? null);
    }
  }

  // A slot counts as "decided" only when (a) the feeding group(s) have fully
  // played out — a winner/runner-up slot once its own group is done, a third
  // slot once ALL groups are (best-8 thirds span all 12) — AND (b) the sim landed
  // a single team. Requiring (a) stops a lopsided small sample from false-locking
  // an open slot; requiring (b) keeps a completed-but-tied group (two teams headed
  // to a drawing of lots) honestly shown as a split rather than a lock. Both feed
  // the locked rendering and the "hide once the bracket is set" gate.
  const finishedPer: Record<string, number> = {};
  const remainingPer: Record<string, number> = {};
  for (const r of input.finished) finishedPer[TEAM_GROUP[r.homeCode]] = (finishedPer[TEAM_GROUP[r.homeCode]] ?? 0) + 1;
  for (const r of input.remaining) remainingPer[TEAM_GROUP[r.homeCode]] = (remainingPer[TEAM_GROUP[r.homeCode]] ?? 0) + 1;
  const groupDone = (g: GroupLetter) => (remainingPer[g] ?? 0) === 0 && (finishedPer[g] ?? 0) === GROUP_SIZE;
  const allDone = (Object.keys(GROUPS) as GroupLetter[]).every(groupDone);
  const slotDecided = (slot: R32Slot) => ("third" in slot ? allDone : groupDone(slot.group));

  const project = (slot: R32Slot, c: SlotCounter): R32SlotProjection => {
    const candidates = toProjection(c);
    return { label: r32SlotLabel(slot), decided: slotDecided(slot) && candidates.length === 1, candidates };
  };

  return R32.map((m) => {
    const c = counters.get(m.id)!;
    const v = venueFor(m.id)!; // every R32 id (73..88) is covered by MATCH_CITY
    const kickoff = kickoffFor(m.id);
    return {
      matchNo: m.id,
      venue: v.venue,
      city: v.city,
      cityToken: v.cityToken as CityToken,
      kickoff: kickoff ? kickoff.toISOString() : null,
      a: project(m.a, c.a),
      b: project(m.b, c.b),
    };
  });
}
