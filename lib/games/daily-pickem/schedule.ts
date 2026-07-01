// Schedule helpers for the knockout leg of the daily pick'em — the analog of the
// group-stage helpers in lib/pool/match-day-3.ts, but for the 31 scored knockout
// fixtures. Pure and dependency-light (schedule constants only, no DB), so the
// open/lock rules stay unit-testable and can't drift from the per-match lock in
// lib/games/daily-pickem/picks.ts (isDailyKnockoutLocked).

import { kickoffFor } from "@/lib/scoring/schedule";
import { DAILY_KNOCKOUT_MATCH_NOS } from "./scope";
import { FINAL } from "@/lib/scoring/data";

// The kickoffs of the earliest / latest scored knockout fixture, derived once.
// The first is the Round-of-32 opener (match 73); the last is the Final (104).
const KICKOFFS: Date[] = DAILY_KNOCKOUT_MATCH_NOS.map((no) => kickoffFor(no)).filter(
  (d): d is Date => d != null,
);

export function firstKnockoutKickoff(): Date | null {
  if (KICKOFFS.length === 0) return null;
  return KICKOFFS.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

export function lastKnockoutKickoff(): Date | null {
  return kickoffFor(FINAL.id) ?? (KICKOFFS.length ? KICKOFFS.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b)) : null);
}

// Whether the knockout pick'em is still live to play: the Final hasn't kicked off,
// so at least one fixture can still be edited. Mirrors isMd3GameOpen for the group
// leg. Once the Final locks the whole game is read-only (leaderboard-only).
export function isDailyKnockoutGameOpen(now: Date = new Date()): boolean {
  const last = lastKnockoutKickoff();
  if (!last) return false;
  return now.getTime() < last.getTime();
}

// The match-day bucket a knockout fixture belongs to — its kickoff calendar date in
// US Eastern time (the tournament's reference match-day boundary), as an ISO
// yyyy-mm-dd string. Fixtures with no scheduled kickoff bucket to "unscheduled" so
// they never collapse into a real day. Used to track standings "by day".
const MATCH_DAY_TZ = "America/New_York";
const MATCH_DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: MATCH_DAY_TZ,
});

export function dailyKnockoutMatchDay(matchNo: number): string {
  const at = kickoffFor(matchNo);
  if (!at) return "unscheduled";
  return MATCH_DAY_FMT.format(at); // e.g. "2026-07-03"
}

// The scored knockout fixtures grouped by ET match-day, ascending, as [day,
// matchNos] pairs (matchNos sorted). "unscheduled" (no kickoff) sorts last. Powers
// the by-day sub-boards, Day-Winner crowns and Perfect-Day eligibility.
export function knockoutMatchDays(): [string, number[]][] {
  const byDay = new Map<string, number[]>();
  for (const no of DAILY_KNOCKOUT_MATCH_NOS) {
    const day = dailyKnockoutMatchDay(no);
    const list = byDay.get(day) ?? [];
    list.push(no);
    byDay.set(day, list);
  }
  return [...byDay.entries()]
    .map(([day, nos]) => [day, [...nos].sort((a, b) => a - b)] as [string, number[]])
    .sort((a, b) => (a[0] === "unscheduled" ? 1 : b[0] === "unscheduled" ? -1 : a[0].localeCompare(b[0])));
}
