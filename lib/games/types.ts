// The unified game-engine contract. HessFest runs three games over shared
// Entry/Pick storage — FULL_BRACKET, KNOCKOUT, MATCH_DAY_3_PICKEM — that used to
// diverge through hard-coded `if` forks in lib/pool/scoring.ts. Each format is now
// one GameModule; gameFor(format) (registry.ts) returns it. The orchestrator owns
// the transaction and the ScoreBreakdown upsert; a module only computes.

import type { Prisma } from "@/generated/prisma/client";
import type { PoolFormat } from "@/lib/pool/manage";
import type { Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";
import type { Md3Tiebreak } from "@/lib/challenge/md3-tiebreak";

type Db = Prisma.TransactionClient;

// A flat pick row as loaded from the DB. Prisma `Pick` rows are structurally
// compatible — they carry these columns plus ids we ignore here.
export interface GamePickRow {
  section: string;
  category: string;
  key: string;
  code: string;
  teamOrValue: string;
}

// An entry ready to score: its pick rows, and (for positional knockout brackets)
// its AdvanceMap. knockoutAdvance is null/absent for full-bracket, CSV, and
// pre-feature entries, which score from their Pick rows exactly as before.
export interface ScorableGameEntry {
  id: string;
  picks: GamePickRow[];
  knockoutAdvance?: unknown;
}

// Everything a module needs to score, independent of which recompute path called
// it. tournamentId lets the MD3 module load its live Result rows; answer/cfg drive
// the bracket oracle; now is for lock decisions (unused by scoring itself).
export interface ScoringContext {
  tournamentId: string;
  answer: Results;
  cfg: ScoringConfig;
  now: Date;
}

// One scored entry, ready for the orchestrator to upsert. byCategory is the
// game-specific breakdown blob (bracket: ScoreBreakdown; MD3: { md3, tb }).
// perPick is present ONLY for games that compute per-pick detail (MD3); bracket
// omits it, so the orchestrator must not write a perPick key for bracket rows.
export interface ScoredEntry {
  entryId: string;
  totalPoints: number;
  byCategory: unknown;
  perPick?: Record<string, number>;
}

// Inputs to a lock decision — per-match (matchNo) or whole-entry (locksAt /
// entryLocked). Modules read only the fields their lock model needs.
export interface LockArgs {
  matchNo?: number;
  locksAt: Date | null;
  entryLocked?: boolean;
  now?: Date;
}

// A row as the leaderboard ranks it. `total` is whatever total the caller ranks
// by — the cached score, or a live (official + projected) total. md3Tiebreak is
// set only for MD3 rows; bracket rows leave it undefined and rank on total alone.
// label is display-only and intentionally NOT read by compareForRank.
export interface RankRow {
  total: number;
  label?: string;
  md3Tiebreak?: Md3Tiebreak;
}

export interface GameModule {
  format: PoolFormat;
  // The pick-row `section` values this game owns.
  ownsSections: readonly string[];
  // The scored match numbers this game covers.
  matchNos(): number[];
  isLocked(args: LockArgs): boolean;
  // Score a batch of loaded entries; returns rows, does NOT upsert.
  scoreEntries(tx: Db, entries: ScorableGameEntry[], ctx: ScoringContext): Promise<ScoredEntry[]>;
  // Leaderboard ranking comparator (<0 if a ranks strictly ahead of b). Encodes
  // the ranking criteria ONLY — total, then any game-specific tiebreak — and is
  // label-free, so callers add label as a display-only nudge and ties share a
  // rank only on a genuine dead heat (see assignRanksByCompare).
  compareForRank(a: RankRow, b: RankRow): number;
}
