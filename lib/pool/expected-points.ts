// Pure expected-points projection: turns the win model (lib/pool/win-model.ts)
// into each entry's expected remaining knockout points, a projected final total,
// and a projected final rank. Reused by the leaderboard projection (Feature 1) and
// the player profile (Feature 3). Env-free + unit-tested.
//
// DISPLAY-ONLY. This never writes ScoreBreakdown or the answer key — it layers a
// forward-looking estimate on top of the real, already-scored total. Only undecided
// knockout matches contribute: group/third-place points are locked once the group
// stage ends, and a decided knockout match's points are already in the entry's
// actual total. Player awards aren't modelled (no usable per-award market), so they
// stay in the actual total and out of the expectation.

import { roundPointsFor, DEFAULT_SCORING, type ScoringConfig } from "@/lib/scoring/score";
import { knockoutDepth, type WinModel } from "@/lib/pool/win-model";

export interface ProjectionEntry {
  entryId: string;
  actualPoints: number; // current scored total (group + decided knockout + awards)
  knockout: Record<number, string | null | undefined>; // matchId -> picked winner code
}

export interface EntryProjection {
  entryId: string;
  actualPoints: number;
  expectedRemaining: number; // EV of points from still-undecided knockout matches
  projectedTotal: number; // actualPoints + expectedRemaining
  projectedRank: number; // competition rank by projectedTotal (ties share a place)
}

// Every scored knockout match id (73..104) except bronze (103), which isn't scored.
function scoredKnockoutMatchIds(): number[] {
  const ids: number[] = [];
  for (let id = 73; id <= 104; id++) if (knockoutDepth(id) != null) ids.push(id);
  return ids;
}

// Expected remaining knockout points for one entry's picks against the model.
export function expectedRemainingPoints(
  knockout: Record<number, string | null | undefined>,
  model: WinModel,
  decided: Record<number, string>,
  cfg: ScoringConfig = DEFAULT_SCORING,
): number {
  let ev = 0;
  for (const matchId of scoredKnockoutMatchIds()) {
    if (decided[matchId]) continue; // already resolved — its points are in the actual total
    const pick = knockout[matchId];
    if (!pick) continue;
    // P(this pick is the team that actually advances out of matchId).
    const prob = model.advance[matchId]?.[pick] ?? 0;
    if (prob > 0) ev += prob * roundPointsFor(matchId, cfg);
  }
  return ev;
}

// Project every entry's final standing. Ranking is by projected total (ties broken
// for display by actual points then entryId, but the rank number itself is
// order-independent — entries on the same projected total share a place).
export function projectStandings(
  entries: ProjectionEntry[],
  model: WinModel,
  decided: Record<number, string>,
  cfg: ScoringConfig = DEFAULT_SCORING,
): EntryProjection[] {
  const projected = entries.map((e) => {
    const expectedRemaining = expectedRemainingPoints(e.knockout, model, decided, cfg);
    return {
      entryId: e.entryId,
      actualPoints: e.actualPoints,
      expectedRemaining,
      projectedTotal: e.actualPoints + expectedRemaining,
    };
  });

  const sorted = [...projected].sort(
    (a, b) =>
      b.projectedTotal - a.projectedTotal ||
      b.actualPoints - a.actualPoints ||
      a.entryId.localeCompare(b.entryId),
  );
  // Standard competition ranking ("1224"): the rank is order-independent — entries
  // on the same projected total share a place — so display order within a tie
  // (actual points, then id) never shifts the rank itself. The epsilon collapses
  // floating-point noise (expectedRemaining is a sum of products of probabilities)
  // so two mathematically-equal totals tie instead of splitting by ~1e-15.
  const EPS = 1e-9;
  return sorted.map((r) => ({
    ...r,
    projectedRank: projected.filter((o) => o.projectedTotal > r.projectedTotal + EPS).length + 1,
  }));
}
