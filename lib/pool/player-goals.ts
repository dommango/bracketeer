// Pure, name-based player helpers for the player drill-down. Env-free (no prisma)
// so they can be unit-tested; the impure getPlayerDetail in player-detail.ts
// composes them. Identity is the normalized name (the schema has no player id).

import { normPlayer } from "@/lib/odds/player-match";

export interface BoardScorer {
  rank: number;
  playerName: string;
  teamCode: string;
  goals: number;
  assists: number | null;
}

// One goal event flattened with the match + the two sides it was scored between.
export interface RawGoalEvent {
  playerName: string | null;
  type: string;
  minute: number;
  extraMinute: number | null;
  teamCode: string;
  matchNo: number;
  roundCode: string;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
}

export interface PlayerGoal {
  matchNo: number;
  roundCode: string;
  minute: number;
  extraMinute: number | null;
  penalty: boolean;
  teamCode: string;
  opponentCode: string | null;
}

// The scoring-board row whose name matches `name` (normalized exact), or null.
export function resolveBoardPlayer(name: string, board: BoardScorer[]): BoardScorer | null {
  const target = normPlayer(name);
  if (!target) return null;
  return board.find((b) => normPlayer(b.playerName) === target) ?? null;
}

// This player's goals (filtered by normalized name), each tagged with its
// opponent, sorted by match then minute. Penalty goals are flagged.
export function buildPlayerGoals(events: RawGoalEvent[], name: string): PlayerGoal[] {
  const target = normPlayer(name);
  if (!target) return [];
  const out: PlayerGoal[] = [];
  for (const e of events) {
    if (!e.playerName || normPlayer(e.playerName) !== target) continue;
    const opponentCode = e.teamCode === e.homeTeamCode ? e.awayTeamCode : e.homeTeamCode;
    out.push({
      matchNo: e.matchNo,
      roundCode: e.roundCode,
      minute: e.minute,
      extraMinute: e.extraMinute,
      penalty: e.type === "PENALTY_GOAL",
      teamCode: e.teamCode,
      opponentCode: opponentCode ?? null,
    });
  }
  return out.sort(
    (a, b) =>
      a.matchNo - b.matchNo ||
      a.minute - b.minute ||
      (a.extraMinute ?? 0) - (b.extraMinute ?? 0),
  );
}
