// Scope of the daily pick'em — which matches it spans and which Pick-row section
// each uses. The daily game EXTENDS Match Day Pickem: the 24 group fixtures keep
// section "match_day_3" byte-for-byte (every live MD3 entry + its decoder keep
// working); the 31 scored knockout matches use a new "daily_knockout" section.
// Purely additive — no migration of existing pick rows.

import { MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import { R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";

export const DAILY_KNOCKOUT_SECTION = "daily_knockout";

// Scored knockout match numbers (R32 → Final). Bronze (103) is excluded — it is
// unscored, matching roundPointsFor / stageOf.
export const DAILY_KNOCKOUT_MATCH_NOS: readonly number[] = [
  ...R32,
  ...R16,
  ...QF,
  ...SF,
  FINAL,
].map((m) => m.id);

const KNOCKOUT_SET = new Set(DAILY_KNOCKOUT_MATCH_NOS);

export function isDailyKnockoutMatchNo(matchNo: number): boolean {
  return KNOCKOUT_SET.has(matchNo);
}

// Every match the daily pick'em covers: MD3 group fixtures + scored knockouts.
export const DAILY_MATCH_NOS: readonly number[] = [
  ...MD3_MATCH_NOS,
  ...DAILY_KNOCKOUT_MATCH_NOS,
];
