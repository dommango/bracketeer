// Pure model behind the in-app bracket builder (PickForm). Given a (possibly
// partial) Picks object it resolves which teams are pickable at each knockout
// stage — cascading group picks → R32 matchups → R16 → … → Final exactly the way
// the scoring engine does — and reports completion progress + validation issues.
//
// Client-safe: imports only the pure scoring data/resolver (no prisma), so the
// browser component can re-derive the live bracket on every selection.

import { GROUPS, TEAMS, R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";
import { resolveR32Slots, winnerOf, type ResolvedR32 } from "@/lib/scoring/resolve";
import type { GroupLetter, Picks, TeamCode } from "@/lib/scoring/types";

export interface TeamRef {
  code: TeamCode;
  name: string;
}

export interface KnockoutSlot {
  matchNo: number;
  a: TeamRef | null;
  b: TeamRef | null;
  pick: TeamCode | null;
}

export interface KnockoutModel {
  r32: KnockoutSlot[];
  r16: KnockoutSlot[];
  qf: KnockoutSlot[];
  sf: KnockoutSlot[];
  final: KnockoutSlot;
}

// The four scored award keys (bronze/match 103 has no award and is not scored).
export const AWARD_KEYS = ["player", "young", "boot", "goal"] as const;
export type AwardKey = (typeof AWARD_KEYS)[number];

// Total picks needed for a complete bracket: 12 groups × (1st + 2nd) = 24,
// 8 third-place advancers, 31 scored knockout winners (16+8+4+2+1), 4 awards.
export const TARGET_GROUPS = 24;
export const TARGET_THIRDS = 8;
export const TARGET_KNOCKOUT = 31;
export const TARGET_AWARDS = AWARD_KEYS.length;

function ref(code: TeamCode | null | undefined): TeamRef | null {
  if (!code) return null;
  return { code, name: TEAMS[code] ?? code };
}

// Resolve every knockout match's two competitors, cascading winners forward.
// Slots are null until their feeders are decided.
//
// The R32 seed determines who contests each Round-of-32 match. In a full-bracket
// pool that comes from the picker's own group picks (the default). In a knockout
// pool the 32 qualifiers are already decided, so the caller passes the official
// seed (resolveR32Slots(officialResults)) and the picker only chooses winners.
export function resolveKnockout(picks: Picks, r32seed?: ResolvedR32): KnockoutModel {
  const r32slots = r32seed ?? resolveR32Slots(picks);

  const r32: KnockoutSlot[] = R32.map((m) => ({
    matchNo: m.id,
    a: ref(r32slots[m.id]?.a),
    b: ref(r32slots[m.id]?.b),
    pick: picks.knockout[m.id] ?? null,
  }));

  const fromFeeders = (matches: { id: number; a: number; b: number }[]): KnockoutSlot[] =>
    matches.map((m) => ({
      matchNo: m.id,
      a: ref(winnerOf(picks, m.a)),
      b: ref(winnerOf(picks, m.b)),
      pick: picks.knockout[m.id] ?? null,
    }));

  const r16 = fromFeeders(R16);
  const qf = fromFeeders(QF);
  const sf = fromFeeders(SF);
  const [final] = fromFeeders([FINAL]);

  return { r32, r16, qf, sf, final };
}

// Every match slot across the knockout cascade, in bracket order — the single
// list both reconcile and the consistency check walk.
function knockoutSlots(model: KnockoutModel): KnockoutSlot[] {
  return [...model.r32, ...model.r16, ...model.qf, ...model.sf, model.final];
}

// Drop any knockout pick that no longer matches its (re-resolved) matchup after
// an upstream change, iterating forward until the bracket is internally
// consistent. Shared by both bracket builders. A full-bracket pool re-resolves
// R32 from the picker's group picks (no seed); a knockout pool passes the fixed
// official seed, so only downstream rounds can shift when an earlier winner
// changes. Pure + immutable: returns a new Picks, never mutates the input.
export function reconcileKnockoutPicks(picks: Picks, seed?: ResolvedR32): Picks {
  let next = picks;
  for (let pass = 0; pass < 6; pass++) {
    const slots = knockoutSlots(resolveKnockout(next, seed));
    const knockout: Record<number, TeamCode> = { ...next.knockout };
    let changed = false;
    for (const s of slots) {
      const pick = knockout[s.matchNo];
      if (pick && pick !== s.a?.code && pick !== s.b?.code) {
        delete knockout[s.matchNo];
        changed = true;
      }
    }
    if (!changed) return next;
    next = { ...next, knockout };
  }
  return next;
}

// Match numbers whose stored winner is not one of the two teams that actually
// contest that match (given the seed + the picker's own upstream winners). Empty
// when every set pick is seated. Used server-side to reject crafted payloads.
export function inconsistentKnockoutPicks(picks: Picks, seed?: ResolvedR32): number[] {
  const slots = knockoutSlots(resolveKnockout(picks, seed));
  const bad: number[] = [];
  for (const s of slots) {
    const pick = picks.knockout[s.matchNo];
    if (pick && pick !== s.a?.code && pick !== s.b?.code) bad.push(s.matchNo);
  }
  return bad;
}

// Flat list of every scored knockout match number, in bracket order.
export function scoredKnockoutNumbers(): number[] {
  return [
    ...R32.map((m) => m.id),
    ...R16.map((m) => m.id),
    ...QF.map((m) => m.id),
    ...SF.map((m) => m.id),
    FINAL.id,
  ];
}

export interface SectionProgress {
  done: number;
  total: number;
}

export interface PickFormProgress {
  groups: SectionProgress;
  thirds: SectionProgress;
  knockout: SectionProgress;
  awards: SectionProgress;
  overall: SectionProgress;
  complete: boolean;
}

export function pickFormProgress(picks: Picks): PickFormProgress {
  let groupsDone = 0;
  for (const g of Object.keys(GROUPS)) {
    if (picks.groupFirst[g]) groupsDone++;
    if (picks.groupSecond[g]) groupsDone++;
  }

  const thirdsDone = Math.min((picks.thirdAdvance ?? []).length, TARGET_THIRDS);

  let knockoutDone = 0;
  for (const n of scoredKnockoutNumbers()) {
    if (picks.knockout[n]) knockoutDone++;
  }

  let awardsDone = 0;
  for (const k of AWARD_KEYS) {
    if ((picks.awards?.[k] ?? "").trim()) awardsDone++;
  }

  const groups: SectionProgress = { done: groupsDone, total: TARGET_GROUPS };
  const thirds: SectionProgress = { done: thirdsDone, total: TARGET_THIRDS };
  const knockout: SectionProgress = { done: knockoutDone, total: TARGET_KNOCKOUT };
  const awards: SectionProgress = { done: awardsDone, total: TARGET_AWARDS };

  const overall: SectionProgress = {
    done: groupsDone + thirdsDone + knockoutDone + awardsDone,
    total: TARGET_GROUPS + TARGET_THIRDS + TARGET_KNOCKOUT + TARGET_AWARDS,
  };

  const errorFree = validatePicks(picks).length === 0;
  const complete =
    errorFree &&
    groupsDone === TARGET_GROUPS &&
    thirdsDone === TARGET_THIRDS &&
    knockoutDone === TARGET_KNOCKOUT;

  return { groups, thirds, knockout, awards, overall, complete };
}

// Progress for a knockout-only pool: just the 31 scored knockout winners (no
// group / third-place sections — the qualifiers are fixed — and no awards, which
// the knockout builder no longer collects). The group/thirds/awards buckets
// report a zero total so a shared progress bar reads 100% once every scored
// knockout winner is chosen. "complete" mirrors that: every winner picked.
export function knockoutOnlyProgress(picks: Picks): PickFormProgress {
  let knockoutDone = 0;
  for (const n of scoredKnockoutNumbers()) {
    if (picks.knockout[n]) knockoutDone++;
  }

  const groups: SectionProgress = { done: 0, total: 0 };
  const thirds: SectionProgress = { done: 0, total: 0 };
  const knockout: SectionProgress = { done: knockoutDone, total: TARGET_KNOCKOUT };
  const awards: SectionProgress = { done: 0, total: 0 };

  const overall: SectionProgress = {
    done: knockoutDone,
    total: TARGET_KNOCKOUT,
  };

  return {
    groups,
    thirds,
    knockout,
    awards,
    overall,
    complete: knockoutDone === TARGET_KNOCKOUT,
  };
}

// Hard validation errors that block a *complete* bracket (a partial draft can
// still be saved). Scoring tolerates missing picks, so we only flag genuine
// contradictions, not incompleteness.
export function validatePicks(picks: Picks): string[] {
  const errors: string[] = [];
  const claimed = new Map<TeamCode, string>();

  const claim = (code: TeamCode | undefined, where: string): void => {
    if (!code) return;
    const prev = claimed.get(code);
    if (prev) {
      errors.push(`${TEAMS[code] ?? code} is picked in both ${prev} and ${where}.`);
    } else {
      claimed.set(code, where);
    }
  };

  for (const g of Object.keys(GROUPS) as GroupLetter[]) {
    const first = picks.groupFirst[g];
    const second = picks.groupSecond[g];
    if (first && second && first === second) {
      errors.push(`Group ${g}: 1st and 2nd place must be different teams.`);
    }
    claim(first, `Group ${g} 1st`);
    claim(second, `Group ${g} 2nd`);
  }

  const thirds = picks.thirdAdvance ?? [];
  if (thirds.length > TARGET_THIRDS) {
    errors.push(`Select at most ${TARGET_THIRDS} third-place teams (you have ${thirds.length}).`);
  }
  for (const code of thirds) claim(code, "third-place advancers");

  return errors;
}
