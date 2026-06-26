// Pure helpers for the standalone Knockout-Challenge game (Pool.format = KNOCKOUT).
//
// A knockout pool's bracket is seeded from the *actual* 32 qualifiers — the
// tournament answer key's resolved Round-of-32 — not from each picker's group
// guesses. Picks open once those 32 are known and lock at the R32 kickoff. This
// module is client-safe (pure data + the scoring resolver, no prisma).

import { GROUPS, R32 } from "@/lib/scoring/data";
import { resolveR32Slots, type ResolvedR32 } from "@/lib/scoring/resolve";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";

const THIRDS_NEEDED = 8;

// Fixed target for the "knockout picks open" countdown. The field is *actually*
// opened data-drivenly (isKnockoutFieldSet, once the answer key seats all 32), but
// that has no timestamp to count toward — so before it flips we count down to this
// fixed instant: just after the final WC2026 group matches (June 27, last kickoffs
// 23:30Z) confirm the bracket, ahead of the Round-of-32 kickoff (June 28 19:00Z).
export const KNOCKOUT_PICKS_OPEN_UTC = "2026-06-28T02:00:00Z";

// The official Round-of-32 matchups (the 32 qualifiers) from the answer key.
// Identical resolution to the live bracket (resolveBracket reuses resolveR32Slots),
// so the pick UI and the displayed bracket can never disagree on who plays whom.
export function knockoutR32Seed(results: Results): ResolvedR32 {
  return resolveR32Slots(results);
}

// True once the 32 qualifiers are fully determined and knockout picks can open.
// Checks answer-key completeness directly — all 12 groups' 1st/2nd plus 8 third
// advancers — rather than inferring it from the resolved seed: resolveR32Slots
// fills third-place slots with a first-eligible *fallback* for partial drafts,
// so a seed with no empty slots does not by itself mean the field is decided.
// Until then the pool shows a "picks open at the draw" state.
export function isKnockoutFieldSet(results: Results): boolean {
  const groupsComplete = Object.keys(GROUPS).every(
    (g) => Boolean(results.groupFirst?.[g]) && Boolean(results.groupSecond?.[g]),
  );
  if (!groupsComplete) return false;

  const thirds = results.thirdAdvance ?? [];
  if (thirds.length !== THIRDS_NEEDED || !thirds.every(Boolean)) return false;

  // With complete, valid inputs the official seed has two concrete teams per
  // R32 match; guard against an inconsistent key that fails to seat its thirds.
  const seed = resolveR32Slots(results);
  return R32.every((m) => Boolean(seed[m.id]?.a) && Boolean(seed[m.id]?.b));
}

// Whether the official R32 seed has at least one fully-determined matchup (both
// teams seated). The trigger for *provisional* knockout picks: as group results
// land, concrete matchups appear and can be picked while the rest stay TBD.
export function hasConcreteR32Slots(results: Results): boolean {
  const seed = resolveR32Slots(results);
  return R32.some((m) => Boolean(seed[m.id]?.a) && Boolean(seed[m.id]?.b));
}

// Knockout-pick open state. Picks open once any R32 matchup is concrete (so users
// can start building early) and become *final* once all 32 qualifiers are seated
// (isKnockoutFieldSet). Between those the field is "provisional": some matchups are
// still TBD, and a landed group result can still shift a seeded slot — a pick on a
// matchup that changes is dropped by reconcileKnockoutPicks (and rejected server-
// side by inconsistentKnockoutPicks), so scores never depend on the provisional fill.
export function knockoutOpenState(results: Results): { open: boolean; provisional: boolean } {
  if (isKnockoutFieldSet(results)) return { open: true, provisional: false };
  if (hasConcreteR32Slots(results)) return { open: true, provisional: true };
  return { open: false, provisional: false };
}

// Reduce a Picks to the only sections a knockout entry owns — the 31 winner
// picks + 4 awards — with empty group / third-place halves. Saving a knockout
// entry through this guarantees it never carries full-bracket data it can't edit
// (e.g. group picks adopted from a claimed CSV import). Immutable: new object.
export function knockoutOnlyPicks(picks: Picks): Picks {
  const base = emptyPicks();
  return {
    ...base,
    knockout: { ...picks.knockout },
    awards: { ...base.awards, ...picks.awards },
  };
}

// Whether a knockout entry can still be edited. Locks at the Round-of-32 kickoff
// (the first R32 match's scheduled time) or when an admin has locked the entry.
// Mirrors lib/pool/lock.ts but keyed off the R32 kickoff rather than the
// tournament start (which, for a knockout pool, is long past). A null kickoff
// (time unknown) never time-locks, so picks stay open until the schedule lands.
export function isKnockoutLocked(
  locksAt: Date | null,
  entryLocked = false,
  now: Date = new Date(),
): boolean {
  if (entryLocked) return true;
  if (!locksAt) return false;
  return now.getTime() >= locksAt.getTime();
}
