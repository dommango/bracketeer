// Read-side helpers for mapping an internal knockout match number to its round,
// human label, and (display-only) point value. This mirrors the round buckets in
// lib/scoring/score.ts's roundPointsFor, but is used purely for *presenting*
// existing scores and ceilings — it never re-scores anything. The scoring engine
// in lib/scoring stays the single source of truth for actual points.

import type { ScoringConfig } from "@/lib/scoring/score";

export type KnockoutRound = "r32" | "r16" | "qf" | "sf" | "bronze" | "final";

// The round a knockout match belongs to, or null for group-stage match numbers.
export function knockoutRound(matchNo: number): KnockoutRound | null {
  if (matchNo >= 73 && matchNo <= 88) return "r32";
  if (matchNo >= 89 && matchNo <= 96) return "r16";
  if (matchNo >= 97 && matchNo <= 100) return "qf";
  if (matchNo === 101 || matchNo === 102) return "sf";
  if (matchNo === 103) return "bronze";
  if (matchNo === 104) return "final";
  return null;
}

const ROUND_LABELS: Record<KnockoutRound, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-final",
  sf: "Semi-final",
  bronze: "Third-place play-off",
  final: "Final",
};

export function roundLabel(matchNo: number): string {
  const r = knockoutRound(matchNo);
  return r ? ROUND_LABELS[r] : "Group stage";
}

// What a correct winner pick for this match is worth, read from the tournament's
// scoring config. Bronze (M103) is intentionally not scored, so it returns 0.
export function roundPoints(matchNo: number, cfg: ScoringConfig): number {
  const r = knockoutRound(matchNo);
  if (!r || r === "bronze") return 0;
  return cfg[r] ?? 0;
}
