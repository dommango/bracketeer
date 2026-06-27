// Small cross-cutting helpers shared by lib/pool/queries.ts and the query modules
// split out of it (queries-odds.ts, queries-stadium.ts). Kept dependency-free of
// those modules so the split never forms an import cycle.

import { TEAMS } from "@/lib/scoring/data";

// Human-readable team name from a code, or "TBD" when unresolved/null.
export const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "TBD";

// Neutral 1X2 prior for a group match with no usable odds.
export const NEUTRAL_GROUP_PRIOR = { homeWinProb: 0.375, drawProb: 0.25, awayWinProb: 0.375 };

// Whether a MatchOdds row carries a usable, normalized 1X2 distribution.
export function usableMatchProbs(o: {
  homeWinProb: number | null;
  drawProb: number | null;
  awayWinProb: number | null;
}): o is { homeWinProb: number; drawProb: number; awayWinProb: number } {
  if (o.homeWinProb == null || o.drawProb == null || o.awayWinProb == null) return false;
  if (o.homeWinProb < 0 || o.drawProb < 0 || o.awayWinProb < 0) return false;
  const sum = o.homeWinProb + o.drawProb + o.awayWinProb;
  return sum > 0.99 && sum < 1.01;
}
