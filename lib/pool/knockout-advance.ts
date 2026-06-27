// Positional knockout picks — the "advance a side, not a team" model behind the
// early bracket builder.
//
// A knockout pick is really "which SIDE of this match advances": side a/b are
// fixed bracket positions (R32 = a group slot like 2A / Runners-up B / a 3rd-place
// slot; R16→Final = the winner of a fixed feeder match), independent of which team
// fills them. Representing in-progress picks as an AdvanceMap lets a user fill the
// bracket against projected placeholders TODAY: when a group finalizes and the
// seed's occupant changes, the SAME AdvanceMap resolves to the new team — the pick
// carries forward instead of being dropped (cf. reconcileKnockoutPicks, which we
// deliberately leave alone for the full-bracket/admin flows).
//
// Persistence and scoring stay 100% team-code: the builder converts AdvanceMap →
// picks.knockout via resolveAdvance before every save, so the CSV/DB pick rows and
// scorePicks are byte-for-byte unchanged. Pure + client-safe (no prisma).

import { R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";
import type { ResolvedR32 } from "@/lib/scoring/resolve";
import type { Picks, TeamCode } from "@/lib/scoring/types";
import type { OutrightProb } from "@/lib/odds/map";

// Which side advances out of each scored knockout match (R32 → Final, no bronze).
export type AdvanceMap = Record<number, "a" | "b">;

// The downstream rounds in feeder order — every entry resolves its competitors
// from the winners of two earlier matches (its `a`/`b` feeder ids). R16 feeds off
// R32, QF off R16, SF off QF, Final off SF, so walking this order resolves cleanly.
const DOWNSTREAM = [...R16, ...QF, ...SF, FINAL];

// Every scored knockout match (R32 → Final, 31 total; bronze excluded). The set of
// match numbers a valid AdvanceMap may key on.
const SCORED_MATCH_IDS = new Set<number>([...R32, ...DOWNSTREAM].map((m) => m.id));

// Structural validation of an untrusted AdvanceMap (e.g. a save payload or a stored
// JSON value): every key is a scored knockout match number and every value is a
// side. Empty is valid (a partial draft). Positional picks are always structurally
// valid — there is no seed to check against — so this replaces the team-code gate
// (inconsistentKnockoutPicks) for early/projected saves.
export function validateAdvanceMap(advance: unknown): advance is AdvanceMap {
  if (!advance || typeof advance !== "object" || Array.isArray(advance)) return false;
  for (const [k, v] of Object.entries(advance as Record<string, unknown>)) {
    if (!SCORED_MATCH_IDS.has(Number(k))) return false;
    if (v !== "a" && v !== "b") return false;
  }
  return true;
}

// Coerce a persisted JSON value to an AdvanceMap, falling back to empty when it's
// missing or malformed (so a bad row degrades to "no positional picks", never throws).
export function asAdvanceMap(value: unknown): AdvanceMap {
  return validateAdvanceMap(value) ? value : {};
}

// Completion by *position*: how many of the 31 scored matches have a side chosen.
// Reads fully (31/31) even before any team is known, unlike team-code progress.
export function advanceProgress(advance: AdvanceMap): { done: number; total: number } {
  let done = 0;
  for (const id of SCORED_MATCH_IDS) {
    if (advance[id] === "a" || advance[id] === "b") done++;
  }
  return { done, total: SCORED_MATCH_IDS.size };
}

// AdvanceMap → concrete winner team codes, resolved against the current seed.
// R32 competitors come from the seed; later rounds from the winners we resolve as
// we go. A match with no chosen side, or whose chosen competitor isn't seated yet
// (still TBD), is simply absent from the result — exactly like a missing pick.
export function resolveAdvance(advance: AdvanceMap, seed: ResolvedR32): Picks["knockout"] {
  const knockout: Record<number, TeamCode> = {};

  const seat = (matchNo: number, a: TeamCode | null, b: TeamCode | null) => {
    const side = advance[matchNo];
    if (!side) return;
    const winner = side === "a" ? a : b;
    if (winner) knockout[matchNo] = winner;
  };

  for (const m of R32) seat(m.id, seed[m.id]?.a ?? null, seed[m.id]?.b ?? null);
  for (const m of DOWNSTREAM) seat(m.id, knockout[m.a] ?? null, knockout[m.b] ?? null);

  return knockout;
}

// Saved team-code picks → AdvanceMap, by recording which side each saved winner
// occupies under the given seed. A pick that matches neither competitor (e.g. the
// occupant swapped since it was saved, with no durable position reference) is
// omitted — the bracket degrades gracefully to today's "needs re-pick" behavior
// for just that match, never crashing or guessing.
export function deriveAdvance(knockout: Picks["knockout"], seed: ResolvedR32): AdvanceMap {
  const advance: AdvanceMap = {};

  const record = (matchNo: number, a: TeamCode | null, b: TeamCode | null) => {
    const pick = knockout[matchNo];
    if (!pick) return;
    if (pick === a) advance[matchNo] = "a";
    else if (pick === b) advance[matchNo] = "b";
  };

  for (const m of R32) record(m.id, seed[m.id]?.a ?? null, seed[m.id]?.b ?? null);
  for (const m of DOWNSTREAM) record(m.id, knockout[m.a] ?? null, knockout[m.b] ?? null);

  return advance;
}

// One-tap "chalk" fill: advance the side whose current occupant has the higher
// championship probability. Resolves forward so each round's favorite carries on.
// Teams with no odds rank below any priced team; with neither side priced (or a
// dead heat) it defaults to side a, so the fill is total and deterministic even
// with the odds integration off.
export function quickFillFavorites(seed: ResolvedR32, outrights: OutrightProb[]): AdvanceMap {
  const prob = new Map(outrights.map((o) => [o.teamCode, o.winProb]));
  const rank = (code: TeamCode | null) => (code ? (prob.get(code) ?? -1) : -2);

  const advance: AdvanceMap = {};
  const knockout: Record<number, TeamCode> = {};

  const fill = (matchNo: number, a: TeamCode | null, b: TeamCode | null) => {
    if (!a && !b) return;
    const side: "a" | "b" = rank(a) >= rank(b) && a ? "a" : b ? "b" : "a";
    advance[matchNo] = side;
    const winner = side === "a" ? a : b;
    if (winner) knockout[matchNo] = winner;
  };

  for (const m of R32) fill(m.id, seed[m.id]?.a ?? null, seed[m.id]?.b ?? null);
  for (const m of DOWNSTREAM) fill(m.id, knockout[m.a] ?? null, knockout[m.b] ?? null);

  return advance;
}
