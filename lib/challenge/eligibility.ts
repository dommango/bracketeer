// Public-challenge entry rules — shared by the leaderboards (which entries count
// toward the prize) and the opt-in path (how many a person may enter). Pure: no
// DB, so the rules are unit-testable in isolation and the board + the opt-in
// guard can never disagree about who's eligible.

import { knockoutOnlyProgress } from "@/lib/pool/pick-form";
import { MD3_MATCH_NOS, type ScoreLine } from "@/lib/pool/match-day-3";
import type { Picks } from "@/lib/scoring/types";

// A person may enter at most this many brackets in a single public challenge.
// Counted per challenge format (KNOCKOUT and MATCH_DAY_3_PICKEM independently).
export const CHALLENGE_ENTRY_CAP = 2;

// A knockout entry is challenge-eligible only when its bracket is complete &
// valid — every scored knockout winner chosen and no contradictions. Reuses the
// same completeness signal the pick UI shows (knockoutOnlyProgress.complete).
export function isKnockoutEntryComplete(picks: Picks): boolean {
  return knockoutOnlyProgress(picks).complete;
}

// An MD3 entry is challenge-eligible only when every one of the 24 round-3
// fixtures has a predicted scoreline. (MD3 locks per-match, so a late entrant who
// missed already-locked fixtures can't be complete and is correctly excluded.)
export function isMd3EntryComplete(scores: Record<number, ScoreLine>): boolean {
  return MD3_MATCH_NOS.every((no) => Boolean(scores[no]));
}
