// Pure "by round" and "by day" grouping of a viewer's knockout pick'em fixtures,
// for the sub-boards the game is tracked on. No DB — derived entirely from the
// decorated DailyKnockoutView, so it's unit-testable and can't drift from the play
// surface. Points are the round-WEIGHTED ladder points (raw per-match points ×
// round multiplier), matching the leaderboard's ladder total.

import { STAGE_ORDER, type Stage } from "@/lib/games/stage";
import { KNOCKOUT_ROUND_WEIGHT, PERFECT_DAY_BASE } from "@/lib/games/daily-pickem/ladder";
import type { DailyKnockoutFixtureVM, DailyKnockoutView } from "@/lib/pool/daily-knockout-view";

export interface BoardBucket {
  key: string; // stage name, or ISO match-day
  label: string; // display label
  weight: number; // the round multiplier applied to this bucket's points
  points: number; // WEIGHTED ladder points earned from scored fixtures in this bucket
  pickedCount: number; // fixtures the viewer predicted
  scoredCount: number; // predicted fixtures that have gone final
  fixtures: DailyKnockoutFixtureVM[];
  // Day buckets only: true once every fixture of a ≥2-match day is final and the
  // viewer scored on all of them (a clean sweep → Perfect Day). Always false for
  // round buckets and incomplete/single-match days.
  perfectDay: boolean;
  // The weighted Perfect-Day bonus earned (0 unless perfectDay).
  perfectDayBonus: number;
}

const STAGE_LABEL: Record<Stage, string> = {
  GROUP: "Group",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  FINAL: "Final",
};

function accumulate(
  fixtures: DailyKnockoutFixtureVM[],
  weight: number,
): { points: number; pickedCount: number; scoredCount: number } {
  let points = 0;
  let pickedCount = 0;
  let scoredCount = 0;
  for (const f of fixtures) {
    if (f.pred) pickedCount += 1;
    if (f.points !== null) {
      points += f.points * weight;
      scoredCount += 1;
    }
  }
  return { points, pickedCount, scoredCount };
}

// Sub-boards by knockout round (R32 → Final), in bracket order. Empty rounds
// (no fixtures at all) are dropped so the board only shows live structure.
export function boardsByRound(view: DailyKnockoutView): BoardBucket[] {
  const out: BoardBucket[] = [];
  for (const stage of STAGE_ORDER) {
    if (stage === "GROUP") continue; // knockout-only game
    const fixtures = view.fixtures.filter((f) => f.stage === stage);
    if (fixtures.length === 0) continue;
    const weight = KNOCKOUT_ROUND_WEIGHT[stage];
    out.push({
      key: stage,
      label: STAGE_LABEL[stage],
      weight,
      ...accumulate(fixtures, weight),
      fixtures,
      perfectDay: false,
      perfectDayBonus: 0,
    });
  }
  return out;
}

const DAY_LABEL_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "America/New_York",
});

function dayLabel(iso: string): string {
  if (iso === "unscheduled") return "To be scheduled";
  const d = new Date(`${iso}T12:00:00Z`);
  return DAY_LABEL_FMT.format(d);
}

// Sub-boards by match day, ascending. Each day sits within one round, so the whole
// day shares that round's multiplier. A ≥2-match day whose fixtures are all final
// and all scored earns the viewer a Perfect Day (+ weighted bonus).
export function boardsByDay(view: DailyKnockoutView): BoardBucket[] {
  const byDay = new Map<string, DailyKnockoutFixtureVM[]>();
  for (const f of view.fixtures) {
    const list = byDay.get(f.matchDay) ?? [];
    list.push(f);
    byDay.set(f.matchDay, list);
  }
  return [...byDay.keys()]
    .sort((a, b) => (a === "unscheduled" ? 1 : b === "unscheduled" ? -1 : a.localeCompare(b)))
    .map((key) => {
      const fixtures = byDay.get(key)!;
      const stage = fixtures[0]?.stage ?? "R32";
      const weight = KNOCKOUT_ROUND_WEIGHT[stage] || 1;
      // Perfect Day: a ≥2-match day, every fixture final, viewer scored on all.
      const seated = fixtures.filter((f) => f.open);
      const perfectDay =
        seated.length >= 2 &&
        seated.every((f) => f.result?.final) &&
        seated.every((f) => (f.points ?? 0) > 0);
      const perfectDayBonus = perfectDay ? PERFECT_DAY_BASE * KNOCKOUT_ROUND_WEIGHT[stage] : 0;
      return {
        key,
        label: dayLabel(key),
        weight,
        ...accumulate(fixtures, weight),
        fixtures,
        perfectDay,
        perfectDayBonus,
      };
    });
}
