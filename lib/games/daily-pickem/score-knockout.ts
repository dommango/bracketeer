// Pure scoring for one daily knockout scoreline prediction. Two additive tiers:
//   1. the displayed score line, scored on the UNCHANGED MD3 5/3/1 ladder
//      (scoreMd3) — a 3–3 ET draw scores on the 3–3 line like any other draw, and
//   2. an advancement bonus: the predicted winner inferred from the predicted line;
//      if it matches the official advancer (winnerCode) the pick earns +1.
// A predicted draw infers NO winner (knockouts always have an advancer via ET/pens,
// but the picker can't indicate a shootout winner) → no bonus. Penalty digits are
// not scored — they are coin-flip noise. The bonus is gated to knockout matches by
// the caller (group fixtures never reach here), so group scores are untouched.

import { scoreMd3, type ScoreLine } from "@/lib/pool/match-day-3";
import type { TeamCode } from "@/lib/scoring/types";

// Default advancement bonus. Kept as a named constant (configurable) so a future
// tournament/config can tune it without touching the ladder.
export const DAILY_ADVANCE_BONUS = 1;

export interface DailyKnockoutScoreInput {
  // teamCode → predicted goals, as stored on the pick rows.
  predByTeam: Record<string, number>;
  homeCode: TeamCode;
  awayCode: TeamCode;
  // The actual displayed score line, oriented to home/away by the fixture codes.
  actual: ScoreLine;
  // The official advancer for this match (Results.knockout[matchNo]), or null when
  // not yet decided. Separate from the score line because a draw advances on pens.
  winnerCode: TeamCode | null;
  advanceBonus?: number;
}

export interface DailyKnockoutScore {
  points: number; // line + bonus
  line: number; // 0 | 1 | 3 | 5
  bonus: number; // 0 or the advancement bonus
}

export function scoreDailyKnockout(input: DailyKnockoutScoreInput): DailyKnockoutScore {
  const predLine: ScoreLine = {
    home: input.predByTeam[input.homeCode] ?? 0,
    away: input.predByTeam[input.awayCode] ?? 0,
  };
  const line = scoreMd3(predLine, input.actual);

  const predWinner =
    predLine.home > predLine.away
      ? input.homeCode
      : predLine.away > predLine.home
        ? input.awayCode
        : null;

  const bonus =
    predWinner && input.winnerCode && predWinner === input.winnerCode
      ? input.advanceBonus ?? DAILY_ADVANCE_BONUS
      : 0;

  return { points: line + bonus, line, bonus };
}
