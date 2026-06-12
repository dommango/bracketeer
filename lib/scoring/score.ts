// Scoring engine — ported verbatim from WorldCup2026Bracket.html's scorePicks().
//
// Point values are read from a ScoringConfig so future tournaments can supply
// their own, but DEFAULT_SCORING reproduces the original tool's constants
// exactly. The golden tests assert byte-for-byte parity against that tool.

import { GROUPS } from "./data";
import type { Picks, Results, ScoreResult } from "./types";

export interface ScoringConfig {
  // Index signature keeps this JSON-serializable (assignable to Prisma's Json input).
  [key: string]: number;
  groupExact: number; // correct team in correct position (1st/2nd)
  groupPartial: number; // right team, wrong position, or a correct 3rd-place team
  thirdAdvancer: number; // correct 3rd-place advancer
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  award: number; // each correct player award
}

export const DEFAULT_SCORING: ScoringConfig = {
  groupExact: 3,
  groupPartial: 1,
  thirdAdvancer: 3,
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  final: 5,
  award: 1,
};

// Per-match knockout point bucket, mirroring the original ROUND_PTS table.
// Match 103 (bronze final) is intentionally absent — it is not scored.
export function roundPointsFor(mid: number, cfg: ScoringConfig): number {
  if (mid >= 73 && mid <= 88) return cfg.r32;
  if (mid >= 89 && mid <= 96) return cfg.r16;
  if (mid >= 97 && mid <= 100) return cfg.qf;
  if (mid === 101 || mid === 102) return cfg.sf;
  if (mid === 104) return cfg.final;
  return 0;
}

export function scorePicks(
  picks: Picks,
  results: Results,
  cfg: ScoringConfig = DEFAULT_SCORING,
): ScoreResult {
  const breakdown = {
    group: 0,
    thirds: 0,
    r32: 0,
    r16: 0,
    qf: 0,
    sf: 0,
    final: 0,
    awards: 0,
  };

  // GROUP: per group, check 1st and 2nd positions.
  for (const g of Object.keys(GROUPS)) {
    const p1 = picks.groupFirst?.[g];
    const p2 = picks.groupSecond?.[g];
    const r1 = results.groupFirst?.[g];
    const r2 = results.groupSecond?.[g];
    const rThirdsLocal = new Set(results.thirdAdvance || []);
    if (p1 && r1) {
      if (p1 === r1) breakdown.group += cfg.groupExact;
      else if (p1 === r2) breakdown.group += cfg.groupPartial;
      else if (rThirdsLocal.has(p1)) breakdown.group += cfg.groupPartial;
    }
    if (p2 && r2) {
      if (p2 === r2) breakdown.group += cfg.groupExact;
      else if (p2 === r1) breakdown.group += cfg.groupPartial;
      else if (rThirdsLocal.has(p2)) breakdown.group += cfg.groupPartial;
    }
  }

  // 3RD-PLACE ADVANCERS.
  const pThirds = new Set(picks.thirdAdvance || []);
  const rThirds = new Set(results.thirdAdvance || []);
  for (const t of pThirds) if (rThirds.has(t)) breakdown.thirds += cfg.thirdAdvancer;

  // KNOCKOUT: award round points where the actual winner matches the pick.
  for (const [midStr, actualWinner] of Object.entries(results.knockout || {})) {
    const mid = +midStr;
    if (!actualWinner) continue;
    const pts = roundPointsFor(mid, cfg);
    if (!pts) continue;
    const pickWinner = picks.knockout?.[mid];
    if (pickWinner && pickWinner === actualWinner) {
      if (mid >= 73 && mid <= 88) breakdown.r32 += pts;
      else if (mid >= 89 && mid <= 96) breakdown.r16 += pts;
      else if (mid >= 97 && mid <= 100) breakdown.qf += pts;
      else if (mid === 101 || mid === 102) breakdown.sf += pts;
      else if (mid === 104) breakdown.final += pts;
    }
  }

  // AWARDS (case-insensitive, trimmed).
  const norm = (s: string | undefined) => (s || "").trim().toLowerCase();
  for (const k of ["player", "young", "boot", "goal"] as const) {
    if (norm(picks.awards?.[k]) && norm(picks.awards?.[k]) === norm(results.awards?.[k])) {
      breakdown.awards += cfg.award;
    }
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown };
}
