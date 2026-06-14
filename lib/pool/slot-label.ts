// Human-friendly labels for knockout feeder slots — what to show in place of
// "TBD" before a knockout team is known. Group-stage slots are real team codes
// and never reach here. Pure + DB-free so it's unit-testable and usable from both
// the match-center (DB slot refs) and the bracket-view (structural refs).

import { R32, R16, QF, SF, BRONZE, FINAL } from "@/lib/scoring/data";

// Round + index for a knockout match number, e.g. 73 → "R32-1", 101 → "SF1".
// QF/SF stay tight (QF1) since their abbrev has no trailing digit to mash with;
// R32/R16 take a dash so "R32" + "1" doesn't read as "R321".
function matchRoundLabel(no: number): string | null {
  if (no >= 73 && no <= 88) return `R32-${no - 72}`;
  if (no >= 89 && no <= 96) return `R16-${no - 88}`;
  if (no >= 97 && no <= 100) return `QF${no - 96}`;
  if (no === 101 || no === 102) return `SF${no - 100}`;
  return null;
}

// Turn a stored slot ref into a short label:
//   "1A" / "2B"      → "1A" / "2B"   (group winner / runner-up)
//   "3rd:ABCDF"      → "3rd"         (one of several third-placed teams)
//   "W101" / "L101"  → "SF1" / "SF1 L" (winner / loser of that match)
export function slotLabel(ref: string | null | undefined): string {
  if (!ref) return "TBD";
  if (/^[12][A-L]$/.test(ref)) return ref;
  if (ref.startsWith("3rd")) return "3rd";
  const wl = ref.match(/^([WL])(\d+)$/);
  if (wl) {
    const base = matchRoundLabel(Number(wl[2]));
    if (!base) return ref;
    return wl[1] === "L" ? `${base} L` : base;
  }
  return ref;
}

function r32Ref(slot: (typeof R32)[number]["a"]): string {
  if ("third" in slot) return `3rd:${slot.third.join("")}`;
  return `${slot.pos}${slot.group}`;
}

// matchNo → [homeRef, awayRef] for every knockout match, derived from the bracket
// structure (mirrors prisma/seed.ts). Lets the pure bracket-view show slot labels
// without a DB round-trip.
export const KNOCKOUT_SLOT_REFS: Record<number, [string, string]> = (() => {
  const refs: Record<number, [string, string]> = {};
  for (const m of R32) refs[m.id] = [r32Ref(m.a), r32Ref(m.b)];
  for (const list of [R16, QF, SF] as const) {
    for (const m of list) refs[m.id] = [`W${m.a}`, `W${m.b}`];
  }
  refs[BRONZE.id] = [`L${BRONZE.aLoser}`, `L${BRONZE.bLoser}`];
  refs[FINAL.id] = [`W${FINAL.a}`, `W${FINAL.b}`];
  return refs;
})();
