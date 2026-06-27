// MATCH_DAY_3_PICKEM game module — the daily-scoreline pickem (group fixtures, now
// EXTENDED through the knockout rounds). Unlike the bracket games it ignores the
// answer key for the score line and scores each predicted scoreline against the
// LIVE per-match Result rows. computeDailyBreakdowns folds the group score
// (section "match_day_3") and the additive knockout score (section
// "daily_knockout") into one ScoredEntry; group-only entries are byte-identical to
// before the extension. It carries per-pick detail and a quality tiebreak, so its
// ScoredEntry includes perPick and ranks via the MD3 tiebreak comparator.

import { isMd3MatchLocked } from "@/lib/pool/match-day-3";
import { isDailyKnockoutLocked } from "@/lib/games/daily-pickem/picks";
import { computeDailyBreakdowns } from "@/lib/games/daily-pickem/score-entries";
import { DAILY_MATCH_NOS, DAILY_KNOCKOUT_SECTION, isDailyKnockoutMatchNo } from "@/lib/games/daily-pickem/scope";
import { compareMd3Tiebreak } from "@/lib/challenge/md3-tiebreak";
import type { GameModule } from "./types";

export const md3Module: GameModule = {
  format: "MATCH_DAY_3_PICKEM",
  ownsSections: ["match_day_3", DAILY_KNOCKOUT_SECTION],
  matchNos: () => [...DAILY_MATCH_NOS],
  // Per-fixture lock at its own kickoff (group or knockout), or whole-entry lock.
  isLocked: ({ matchNo, entryLocked = false, now = new Date() }) =>
    entryLocked ||
    (matchNo != null &&
      (isDailyKnockoutMatchNo(matchNo)
        ? isDailyKnockoutLocked(matchNo, now)
        : isMd3MatchLocked(matchNo, now))),
  scoreEntries: (tx, entries, ctx) => computeDailyBreakdowns(tx, entries, ctx),
  // Label-free: total, then the decisive MD3 quality tiebreak. The caller breaks
  // any remaining display tie by label.
  compareForRank: (a, b) =>
    b.total - a.total || compareMd3Tiebreak(a.md3Tiebreak, b.md3Tiebreak),
};
