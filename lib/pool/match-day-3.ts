// Match Day 3 Pickem — the pure rules for the lightweight group-stage game:
// predict the exact final score of every Match-Day-3 fixture (the final round of
// group games). This module is dependency-light (data + schedule only) and has
// NO DB access, so every rule here is unit-testable in isolation. It deliberately
// never touches the parity-locked scoring oracle (lib/scoring/score.ts) — MD3 is
// scored against live match results, not the tournament answer key.

import { GROUPS, groupMatchups } from "@/lib/scoring/data";
import { kickoffFor } from "@/lib/scoring/schedule";
import type { GroupLetter, TeamCode } from "@/lib/scoring/types";

// A group plays 6 matches across 3 rounds; the 24 Match-Day-3 fixtures are each
// group's final pair. In the internal 1–72 numbering (groups A–L, 6 each, in
// Object.keys order — see buildGroupPairMatchNos), those are positions 3 and 4
// within each group's six, i.e. (matchNo - 1) % 6 ∈ {2, 3}. Verified against the
// simultaneous-kickoff pairs in lib/scoring/schedule.ts MATCH_KICKOFF_UTC.
export function isMd3MatchNo(matchNo: number): boolean {
  if (!Number.isInteger(matchNo) || matchNo < 1 || matchNo > 72) return false;
  const within = (matchNo - 1) % 6;
  return within === 2 || within === 3;
}

// The 24 MD3 match numbers, ascending: 3,4, 9,10, 15,16, … 69,70.
export const MD3_MATCH_NOS: readonly number[] = Array.from({ length: 72 }, (_, i) => i + 1).filter(
  isMd3MatchNo,
);

export interface Md3Fixture {
  matchNo: number;
  group: GroupLetter;
  homeCode: TeamCode;
  awayCode: TeamCode;
  kickoff: Date;
}

// Map each group's 6 ordered pairings to their internal match numbers, then keep
// the MD3 pair. Mirrors buildGroupPairMatchNos' iteration (groups in Object.keys
// order, pairings in groupMatchups order) so the home/away orientation here is
// the canonical draw orientation. Returned in kickoff order.
export function md3Fixtures(): Md3Fixture[] {
  const out: Md3Fixture[] = [];
  let no = 1;
  for (const letter of Object.keys(GROUPS) as GroupLetter[]) {
    for (const [home, away] of groupMatchups(letter)) {
      const matchNo = no++;
      if (!isMd3MatchNo(matchNo)) continue;
      const kickoff = kickoffFor(matchNo);
      if (!kickoff) continue;
      out.push({ matchNo, group: letter, homeCode: home, awayCode: away, kickoff });
    }
  }
  return out.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime() || a.matchNo - b.matchNo);
}

// Per-match lock: a fixture's pick can be edited until its own kickoff. This is
// what makes MD3 a "pickem" rather than a single-lock bracket — later fixtures
// stay open after earlier ones start.
export function md3LockAt(matchNo: number): Date | null {
  return kickoffFor(matchNo);
}

export function isMd3MatchLocked(matchNo: number, now: Date = new Date()): boolean {
  const at = md3LockAt(matchNo);
  if (!at) return false;
  return now.getTime() >= at.getTime();
}

// The earliest and latest MD3 kickoffs — the game opens for play until the last
// one (after which every pick is locked and creating a new game is pointless).
export function firstMd3Kickoff(): Date {
  return md3Fixtures().reduce((min, f) => (f.kickoff < min ? f.kickoff : min), md3Fixtures()[0].kickoff);
}

export function lastMd3Kickoff(): Date {
  return md3Fixtures().reduce((max, f) => (f.kickoff > max ? f.kickoff : max), md3Fixtures()[0].kickoff);
}

// True while at least one MD3 fixture is still open — the window in which a new
// MD3 Pickem game can be created or joined and have any unlocked picks to make.
export function isMd3GameOpen(now: Date = new Date()): boolean {
  return now.getTime() < lastMd3Kickoff().getTime();
}

export interface ScoreLine {
  home: number;
  away: number;
}

// Score one prediction against an actual result, oriented identically (both as
// home–away for the same fixture). The 5/3/1 ladder agreed with the user:
//   • exact scoreline                          → 5
//   • correct result AND correct goal diff     → 3   (e.g. predict 2–1, actual 3–2)
//   • correct result only (W/D/L)              → 1
//   • wrong result                             → 0
// A draw is handled by the goal-difference rule naturally: both diffs are 0, so a
// predicted draw on an actual (different-score) draw earns 3, an exact draw 5.
export function scoreMd3(pred: ScoreLine, actual: ScoreLine): 0 | 1 | 3 | 5 {
  if (pred.home === actual.home && pred.away === actual.away) return 5;
  const predResult = Math.sign(pred.home - pred.away);
  const actualResult = Math.sign(actual.home - actual.away);
  if (predResult !== actualResult) return 0;
  // Same result (both win for the same side, or both draws). Reward a matching
  // goal difference one tier higher than a bare correct result.
  if (pred.home - pred.away === actual.home - actual.away) return 3;
  return 1;
}
