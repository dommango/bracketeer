// The knockout pick'em's competitive layer — a PURE, display-only scoring model
// computed over the already-cached ScoreBreakdown.perPick (raw per-match points,
// keyed "M{no}"). No engine/parity risk: score-knockout.ts / computeDailyKnockout
// and their tests stay untouched; this only re-weights + aggregates what they cached.
//
// The Ladder doubles each round's multiplier to offset the bracket's halving (16
// R32 → 8 R16 → 4 QF → 2 SF → 1 Final), so every round's total point pool is ~equal
// and one Final pick is worth 16 R32 picks — keeping comebacks alive to the Final.

import { stageOf, STAGE_ORDER, type Stage } from "@/lib/games/stage";
import { knockoutMatchDays } from "./schedule";

export const KNOCKOUT_ROUND_WEIGHT: Record<Stage, number> = {
  GROUP: 0, // knockout-only game — group matches never contribute to the ladder
  R32: 1,
  R16: 2,
  QF: 4,
  SF: 8,
  FINAL: 16,
};

// A clean-sweep bonus (à la Superbru's Grand Slam Point), scaled by the day's round
// so a perfect deep-round day is worth more. Only ≥2-match days (all of R32 + R16)
// are eligible; single-match days (QF→Final) can't be "swept".
export const PERFECT_DAY_BASE = 3;

export function roundWeight(matchNo: number): number {
  const stage = stageOf(matchNo);
  return stage ? KNOCKOUT_ROUND_WEIGHT[stage] : 0;
}

// A perPick map restricted to scored knockout matches (drops group ≤72 and unscored).
function knockoutEntries(perPick: Record<string, number> | null | undefined): [number, number][] {
  const out: [number, number][] = [];
  for (const [key, value] of Object.entries(perPick ?? {})) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const matchNo = Number(key.replace(/^M/, ""));
    const stage = stageOf(matchNo);
    if (!stage || stage === "GROUP") continue;
    out.push([matchNo, value]);
  }
  return out;
}

// The round-weighted Ladder total for one entry's cached perPick — the board's
// ranking value. Group points never count (weight 0).
export function knockoutLadderPoints(perPick: Record<string, number> | null | undefined): number {
  let total = 0;
  for (const [matchNo, points] of knockoutEntries(perPick)) {
    total += points * roundWeight(matchNo);
  }
  return total;
}

// Weighted Ladder points per round, in bracket order — the Round-Champion sub-boards
// (weighting is constant within a round, so it doesn't change the ranking, but the
// displayed figure matches the ladder). Rounds with no cached points are still keyed
// (0) so the caller can decide what to render.
export function ladderPointsByRound(
  perPick: Record<string, number> | null | undefined,
): Record<Stage, number> {
  const byRound: Record<Stage, number> = { GROUP: 0, R32: 0, R16: 0, QF: 0, SF: 0, FINAL: 0 };
  for (const [matchNo, points] of knockoutEntries(perPick)) {
    const stage = stageOf(matchNo)!;
    byRound[stage] += points * roundWeight(matchNo);
  }
  return byRound;
}

// Weighted Ladder points per ET match-day — the Match-Day sub-boards / Day-Winner
// crowns. Keyed by the yyyy-mm-dd match-day the fixture kicks off on.
export function ladderPointsByDay(
  perPick: Record<string, number> | null | undefined,
): Record<string, number> {
  const dayOf = matchDayLookup();
  const byDay: Record<string, number> = {};
  for (const [matchNo, points] of knockoutEntries(perPick)) {
    const day = dayOf.get(matchNo);
    if (!day) continue;
    byDay[day] = (byDay[day] ?? 0) + points * roundWeight(matchNo);
  }
  return byDay;
}

// matchNo → its ET match-day, built once from the full knockout schedule.
function matchDayLookup(): Map<number, string> {
  const lookup = new Map<number, string>();
  for (const [day, matchNos] of knockoutMatchDays()) {
    for (const no of matchNos) lookup.set(no, day);
  }
  return lookup;
}

export interface PerfectEligibleDay {
  day: string; // yyyy-mm-dd
  stage: Stage; // the round this day belongs to (each ET day sits within one round)
  matchNos: number[]; // the day's scored knockout fixtures (≥2)
}

// The ≥2-match days whose every fixture is FINAL — the only days a Perfect Day can
// be awarded on. Derived purely from the schedule + the set of final match numbers.
export function perfectEligibleDays(finalMatchNos: ReadonlySet<number>): PerfectEligibleDay[] {
  const out: PerfectEligibleDay[] = [];
  for (const [day, matchNos] of knockoutMatchDays()) {
    if (matchNos.length < 2) continue; // single-match days can't be swept
    if (!matchNos.every((no) => finalMatchNos.has(no))) continue; // day not complete
    const stage = stageOf(matchNos[0]);
    if (!stage || stage === "GROUP") continue;
    out.push({ day, stage, matchNos: [...matchNos] });
  }
  return out;
}

// The Perfect-Day bonus for one entry: for each completed ≥2-match day on which the
// entry scored on EVERY fixture, award PERFECT_DAY_BASE × the day's round weight.
export function perfectDayBonus(
  perPick: Record<string, number> | null | undefined,
  days: readonly PerfectEligibleDay[],
): number {
  const pp = perPick ?? {};
  let bonus = 0;
  for (const day of days) {
    const swept = day.matchNos.every((no) => (pp[`M${no}`] ?? 0) > 0);
    if (swept) bonus += PERFECT_DAY_BASE * KNOCKOUT_ROUND_WEIGHT[day.stage];
  }
  return bonus;
}

// The complete Ladder total for one entry: weighted round points + Perfect-Day
// bonuses. This is the leaderboard's ranking value.
export function knockoutLadderTotal(
  perPick: Record<string, number> | null | undefined,
  perfectDays: readonly PerfectEligibleDay[],
): number {
  return knockoutLadderPoints(perPick) + perfectDayBonus(perPick, perfectDays);
}

export { STAGE_ORDER };
