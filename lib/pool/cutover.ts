// Placement-credit cutover: the immutable before/after audit record written by
// scripts/adopt-placement-credit.ts when the pool adopted placement-agnostic
// knockout scoring. Read by the statement page (/pool/[code]/scoring) and the
// leaderboard (banner + per-row change chips). Pure data + selectors — no DB.

import record from "@/data/placement-credit-cutover.json";

export interface CutoverEntry {
  entryId: string;
  label: string;
  beforeTotal: number;
  afterTotal: number;
  beforeRank: number;
  afterRank: number;
  rankDelta: number; // beforeRank − afterRank (positive = climbed)
  pointsDelta: number;
}

export interface CutoverRecord {
  generatedAt: string;
  tournamentId: string;
  poolId: string;
  poolName: string;
  rule: string;
  finalWinner: string;
  entries: CutoverEntry[];
}

export const CUTOVER = record as CutoverRecord;

// The rule change is permanent, but the leaderboard banner and per-row "moved on
// cutover" chips are only worth surfacing for a while — after this the board
// reads as the new normal and the statement page keeps the full history. The
// statement page itself is not time-boxed.
export const CUTOVER_UNTIL = new Date("2026-08-20T00:00:00Z");

export function isCutoverActive(now: Date = new Date()): boolean {
  return now < CUTOVER_UNTIL;
}

// Per-entry rank/points move at cutover, keyed by entryId — for the leaderboard chip.
export const cutoverByEntry: Map<string, { rankDelta: number; pointsDelta: number }> = new Map(
  CUTOVER.entries.map((e) => [e.entryId, { rankDelta: e.rankDelta, pointsDelta: e.pointsDelta }]),
);

// True when this record describes the given pool (chips/banner are pool-scoped).
export function cutoverAppliesTo(poolId: string): boolean {
  return CUTOVER.poolId === poolId;
}

// Headline counts for the banner/statement summary.
export function cutoverSummary() {
  const moved = CUTOVER.entries.filter((e) => e.rankDelta !== 0).length;
  const gained = CUTOVER.entries.filter((e) => e.pointsDelta > 0).length;
  return { total: CUTOVER.entries.length, moved, gained };
}
