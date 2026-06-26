// Decisive tiebreak for the Match Day Pickem (MD3) challenge board. MD3 entries
// tied on total points are separated by prediction QUALITY, not alphabetically:
// most exact scorelines first, then most result+goal-difference hits, then most
// correct results, and finally the entry whose aggregate predicted goals land
// closest to the actual aggregate. All four are derived from the same per-pick
// scoring already cached on the breakdown, so players are never asked for an extra
// tiebreak prediction (unlike the full-bracket "goals in the final" field).

export interface Md3Tiebreak {
  exact: number; // count of 5-pt picks (exact scoreline)
  gd: number; // count of 3-pt picks (right result + matching goal difference)
  result: number; // count of 1-pt picks (right result only)
  goalDelta: number; // |Σ predicted goals − Σ actual goals| over scored matches; lower is better
}

// Build the vector from a finished per-pick map (M-no → points) plus the aggregate
// predicted/actual goal totals over the matches that have been scored.
export function buildMd3Tiebreak(
  perPick: Record<string, number>,
  predGoals: number,
  actualGoals: number,
): Md3Tiebreak {
  let exact = 0;
  let gd = 0;
  let result = 0;
  for (const p of Object.values(perPick)) {
    if (p === 5) exact += 1;
    else if (p === 3) gd += 1;
    else if (p === 1) result += 1;
  }
  return { exact, gd, result, goalDelta: Math.abs(predGoals - actualGoals) };
}

// Ordering comparator: <0 if a ranks ahead of b, >0 if behind, 0 on a dead heat.
// Higher exact/gd/result win; lower goalDelta wins. If either side is undefined
// (a non-MD3 row, or an entry not yet rescored against any final result) the result
// is 0 so the caller's prior order (live total, then label) stands untouched.
export function compareMd3Tiebreak(
  a: Md3Tiebreak | undefined,
  b: Md3Tiebreak | undefined,
): number {
  if (!a || !b) return 0;
  return (
    b.exact - a.exact ||
    b.gd - a.gd ||
    b.result - a.result ||
    a.goalDelta - b.goalDelta
  );
}

// Pull the vector back off a cached ScoreBreakdown.byCategory blob (stored as
// Json, typed here as unknown). Returns undefined for any pre-tiebreak breakdown
// (older rows whose byCategory is just `{ md3: total }`) so those fall back to the
// label tiebreak until their next recompute writes the `tb` block.
export function parseMd3Tiebreak(byCategory: unknown): Md3Tiebreak | undefined {
  if (!byCategory || typeof byCategory !== "object") return undefined;
  const tb = (byCategory as Record<string, unknown>).tb;
  if (!tb || typeof tb !== "object") return undefined;
  const r = tb as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const exact = num(r.exact);
  const gd = num(r.gd);
  const result = num(r.result);
  const goalDelta = num(r.goalDelta);
  if (exact === null || gd === null || result === null || goalDelta === null) return undefined;
  return { exact, gd, result, goalDelta };
}
