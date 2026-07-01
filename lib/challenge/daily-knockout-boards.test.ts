import { describe, it, expect } from "vitest";
import { boardsByRound, boardsByDay } from "./daily-knockout-boards";
import type { DailyKnockoutFixtureVM, DailyKnockoutView } from "@/lib/pool/daily-knockout-view";
import type { Stage } from "@/lib/games/stage";

// A minimal fixture VM factory — only the fields the pure grouping reads.
function vm(
  matchNo: number,
  stage: Stage,
  matchDay: string,
  opts: { pred?: boolean; points?: number | null; final?: boolean } = {},
): DailyKnockoutFixtureVM {
  return {
    matchNo,
    stage,
    matchDay,
    homeCode: "AAA",
    awayCode: "BBB",
    homeName: "A",
    awayName: "B",
    kickoffISO: `${matchDay}T19:00:00.000Z`,
    open: true,
    locked: false,
    pred: opts.pred ? { home: 1, away: 0 } : null,
    predHidden: false,
    result: opts.final ? { home: 1, away: 0, final: true } : null,
    points: opts.points ?? null,
    odds: null,
  };
}

function view(fixtures: DailyKnockoutFixtureVM[]): DailyKnockoutView {
  return { fixtures, totalPoints: 0, scoredCount: 0, pickedCount: 0, openCount: 0, missedCount: 0 };
}

describe("boardsByRound", () => {
  it("groups knockout fixtures by round in bracket order, weighting points, dropping empty rounds", () => {
    const v = view([
      vm(89, "R16", "2026-07-04", { pred: true, points: 5, final: true }),
      vm(73, "R32", "2026-06-28", { pred: true, points: 3, final: true }),
      vm(74, "R32", "2026-06-28"),
      vm(104, "FINAL", "2026-07-19"),
    ]);
    const rounds = boardsByRound(v);
    expect(rounds.map((r) => r.key)).toEqual(["R32", "R16", "FINAL"]);
    // R32 (×1): one predicted & scored, 3 raw × 1 = 3.
    const r32 = rounds.find((r) => r.key === "R32")!;
    expect(r32.weight).toBe(1);
    expect(r32.fixtures).toHaveLength(2);
    expect(r32.pickedCount).toBe(1);
    expect(r32.points).toBe(3);
    expect(r32.scoredCount).toBe(1);
    // R16 (×2): 5 raw × 2 = 10.
    const r16 = rounds.find((r) => r.key === "R16")!;
    expect(r16.weight).toBe(2);
    expect(r16.points).toBe(10);
  });

  it("never includes a GROUP round (knockout-only game)", () => {
    const v = view([vm(3, "GROUP", "2026-06-24", { pred: true, points: 5 }), vm(73, "R32", "2026-06-28")]);
    expect(boardsByRound(v).map((r) => r.key)).toEqual(["R32"]);
  });
});

describe("boardsByDay", () => {
  it("groups fixtures by match day, ascending, with weighted per-day totals", () => {
    const v = view([
      vm(89, "R16", "2026-07-04", { pred: true, points: 1, final: true }),
      vm(73, "R32", "2026-06-28", { pred: true, points: 5, final: true }),
      vm(74, "R32", "2026-06-28", { pred: true, points: 3, final: true }),
    ]);
    const days = boardsByDay(v);
    expect(days.map((d) => d.key)).toEqual(["2026-06-28", "2026-07-04"]);
    expect(days[0].points).toBe(8); // (5 + 3) × 1 on June 28 (R32)
    expect(days[0].pickedCount).toBe(2);
    expect(days[1].points).toBe(2); // 1 × 2 on July 4 (R16)
  });

  it("crowns a Perfect Day when every fixture of a ≥2-match day is final and scored", () => {
    const perfect = view([
      vm(73, "R32", "2026-06-28", { pred: true, points: 5, final: true }),
      vm(74, "R32", "2026-06-28", { pred: true, points: 1, final: true }),
    ]);
    const day = boardsByDay(perfect)[0];
    expect(day.perfectDay).toBe(true);
    expect(day.perfectDayBonus).toBeGreaterThan(0);

    // A single miss (0 points) breaks the sweep.
    const broken = view([
      vm(73, "R32", "2026-06-28", { pred: true, points: 5, final: true }),
      vm(74, "R32", "2026-06-28", { pred: true, points: 0, final: true }),
    ]);
    expect(boardsByDay(broken)[0].perfectDay).toBe(false);

    // A single-match day can't be swept.
    const single = view([vm(104, "FINAL", "2026-07-19", { pred: true, points: 5, final: true })]);
    expect(boardsByDay(single)[0].perfectDay).toBe(false);
  });

  it("sorts unscheduled fixtures to the end", () => {
    const v = view([vm(104, "FINAL", "unscheduled"), vm(73, "R32", "2026-06-28")]);
    expect(boardsByDay(v).map((d) => d.key)).toEqual(["2026-06-28", "unscheduled"]);
  });
});
