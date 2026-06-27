// MATCH_DAY_3_PICKEM game module — the daily-scoreline pickem. Unlike the bracket
// games it ignores the answer key and scores each predicted scoreline against the
// LIVE per-match Result rows (loaded inside computeMd3Breakdowns from
// ctx.tournamentId). It carries per-pick detail and a quality tiebreak, so its
// ScoredEntry includes perPick and ranks via the MD3 tiebreak comparator.

import { MD3_MATCH_NOS, isMd3MatchLocked } from "@/lib/pool/match-day-3";
import { computeMd3Breakdowns } from "@/lib/pool/md3-scoring";
import { compareMd3Tiebreak } from "@/lib/challenge/md3-tiebreak";
import type { GameModule } from "./types";

export const md3Module: GameModule = {
  format: "MATCH_DAY_3_PICKEM",
  ownsSections: ["match_day_3"],
  matchNos: () => [...MD3_MATCH_NOS],
  // MD3 locks per fixture at its own kickoff (or when the whole entry is locked).
  isLocked: ({ matchNo, entryLocked = false, now = new Date() }) =>
    entryLocked || (matchNo != null && isMd3MatchLocked(matchNo, now)),
  scoreEntries: (tx, entries, ctx) => computeMd3Breakdowns(tx, entries, ctx.tournamentId),
  compareForRank: (a, b) =>
    b.total - a.total ||
    compareMd3Tiebreak(a.md3Tiebreak, b.md3Tiebreak) ||
    a.label.localeCompare(b.label),
};
