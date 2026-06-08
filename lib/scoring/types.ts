// Shared types for the WC2026 scoring engine. These mirror the in-browser data
// shapes used by the original WorldCup2026Bracket.html so that picks exported
// from that tool score identically here.

export type TeamCode = string;
export type GroupLetter = string;

export interface Awards {
  player: string;
  young: string;
  boot: string;
  goal: string;
}

export interface Picks {
  groupFirst: Record<GroupLetter, TeamCode>;
  groupSecond: Record<GroupLetter, TeamCode>;
  thirdAdvance: TeamCode[];
  knockout: Record<number, TeamCode>;
  awards: Awards;
}

// Results (the "answer key") share the picks shape, plus an optional tiebreaker.
export interface Results extends Picks {
  finalGoals?: number | null;
}

export interface Contestant {
  name: string;
  email: string;
  tiebreak: string;
}

export interface Submission {
  contestant: Contestant;
  picks: Picks;
}

export interface ScoreBreakdown {
  // Index signature keeps this JSON-serializable (assignable to Prisma's Json input).
  [key: string]: number;
  group: number;
  thirds: number;
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  awards: number;
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
}

export function emptyPicks(): Picks {
  return {
    groupFirst: {},
    groupSecond: {},
    thirdAdvance: [],
    knockout: {},
    awards: { player: "", young: "", boot: "", goal: "" },
  };
}
