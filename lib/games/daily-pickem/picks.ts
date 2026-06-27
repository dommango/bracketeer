// Daily pick'em knockout prediction storage — the PURE half (decode / encode /
// merge / per-match lock), with no prisma import, so the scoring and registry paths
// can use it without pulling in lib/db (mirrors how md3-scoring keeps its own
// decoder separate from the prisma-bearing md3-picks). The DB upsert lives in
// lib/pool/daily-picks.ts, which re-exports this API.
//
// Two rows per fixture mirror the Pick column semantics:
//   section="daily_knockout"  category="M89"  key="home"  code=<homeCode>  teamOrValue="2"
//   section="daily_knockout"  category="M89"  key="away"  code=<awayCode>  teamOrValue="1"

import { kickoffFor } from "@/lib/scoring/schedule";
import { DAILY_KNOCKOUT_SECTION, isDailyKnockoutMatchNo } from "./scope";
import type { DailyKnockoutFixture } from "./fixtures";

const MAX_GOALS = 99;

export interface ScoreLine {
  home: number;
  away: number;
}
export type DailyKnockoutScores = Record<number, ScoreLine>;

export type DailyPickRow = {
  section: string;
  category: string;
  key: string;
  code: string;
  teamOrValue: string;
};

function clampGoals(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  if (n < 0 || n > MAX_GOALS) return null;
  return n;
}

// Per-match lock: a knockout fixture's pick can be edited until its own kickoff.
export function isDailyKnockoutLocked(matchNo: number, now: Date = new Date()): boolean {
  const at = kickoffFor(matchNo);
  if (!at) return false;
  return now.getTime() >= at.getTime();
}

// Decode daily_knockout pick rows → { matchNo: { teamCode: goals } }, for SCORING
// (orientation recovered by team code against the fixture). Mirrors md3-scoring's
// decodePickRows but keyed on the daily_knockout section.
export function decodeDailyKnockoutByTeam(
  picks: DailyPickRow[],
): Map<number, Record<string, number>> {
  const out = new Map<number, Record<string, number>>();
  for (const p of picks) {
    if (p.section !== DAILY_KNOCKOUT_SECTION) continue;
    const matchNo = Number(p.category.replace(/^M/, ""));
    if (!isDailyKnockoutMatchNo(matchNo)) continue;
    const goals = clampGoals(Number(p.teamOrValue));
    if (goals === null || !p.code) continue;
    const cur = out.get(matchNo) ?? {};
    cur[p.code] = goals;
    out.set(matchNo, cur);
  }
  return out;
}

// Decode daily_knockout pick rows → { matchNo: { home, away } } oriented by the
// resolved fixtures, for the FORM/display.
export function decodeDailyKnockoutScores(
  picks: DailyPickRow[],
  fixtures: DailyKnockoutFixture[],
): DailyKnockoutScores {
  const byTeam = decodeDailyKnockoutByTeam(picks);
  const out: DailyKnockoutScores = {};
  for (const f of fixtures) {
    if (!f.homeCode || !f.awayCode) continue;
    const pred = byTeam.get(f.matchNo);
    if (!pred) continue;
    if (!(f.homeCode in pred) || !(f.awayCode in pred)) continue;
    out[f.matchNo] = { home: pred[f.homeCode], away: pred[f.awayCode] };
  }
  return out;
}

// Build the canonical daily_knockout Pick rows for a set of scores, pulling each
// fixture's home/away team codes from the resolved fixtures (server-authoritative
// orientation). A score for a fixture that isn't open or out of range is skipped.
export function dailyKnockoutRowsFor(
  scores: DailyKnockoutScores,
  fixtures: DailyKnockoutFixture[],
): DailyPickRow[] {
  const byNo = new Map(fixtures.map((f) => [f.matchNo, f]));
  const rows: DailyPickRow[] = [];
  for (const [matchNoStr, line] of Object.entries(scores)) {
    const matchNo = Number(matchNoStr);
    const fixture = byNo.get(matchNo);
    if (!fixture || !fixture.homeCode || !fixture.awayCode) continue;
    const home = clampGoals(line.home);
    const away = clampGoals(line.away);
    if (home === null || away === null) continue;
    rows.push({ section: DAILY_KNOCKOUT_SECTION, category: `M${matchNo}`, key: "home", code: fixture.homeCode, teamOrValue: String(home) });
    rows.push({ section: DAILY_KNOCKOUT_SECTION, category: `M${matchNo}`, key: "away", code: fixture.awayCode, teamOrValue: String(away) });
  }
  return rows;
}

// Merge submitted knockout scores over current ones honoring the per-match lock: a
// fixture already kicked off is frozen to its stored value; an open, unlocked
// fixture takes the submitted value when present, else keeps the current one.
export function mergeDailyKnockoutScores(
  current: DailyKnockoutScores,
  submitted: DailyKnockoutScores,
  fixtures: DailyKnockoutFixture[],
  now: Date,
): DailyKnockoutScores {
  const merged: DailyKnockoutScores = {};
  for (const f of fixtures) {
    if (!f.open) {
      if (current[f.matchNo]) merged[f.matchNo] = current[f.matchNo];
      continue;
    }
    const locked = isDailyKnockoutLocked(f.matchNo, now);
    const chosen = locked ? current[f.matchNo] : submitted[f.matchNo] ?? current[f.matchNo];
    if (chosen) merged[f.matchNo] = chosen;
  }
  return merged;
}
