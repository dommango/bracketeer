// Pre-match "upset watch": from the win-probabilities we already store, rank the
// upcoming matches most likely to defy the favorite, and flag the ones involving
// a team the viewer backed. Pure + env-free (no DB, no network) so it's
// unit-testable; the prisma side (getUpsetRadar) lives in queries.ts.

import { TEAMS } from "@/lib/scoring/data";
import type { Picks } from "@/lib/scoring/types";
import type { ImpliedProbs } from "@/lib/odds/map";

const teamName = (code: string): string => TEAMS[code] ?? code;

// One upcoming match with its resolved teams and implied win-probs.
export interface UpsetMatchInput {
  matchNo: number;
  scheduledAt: string | null; // ISO
  homeCode: string | null;
  awayCode: string | null;
  odds: ImpliedProbs | null;
}

export type UpsetKind = "tossup" | "upsetAlert";

export interface UpsetSide {
  code: string;
  name: string;
  winProb: number; // 0..1
}

export interface UpsetStake {
  code: string;
  side: "favorite" | "underdog"; // which side of this match the viewer backed
}

export interface UpsetRow {
  matchNo: number;
  scheduledAt: string | null;
  favorite: UpsetSide;
  underdog: UpsetSide;
  drawProb: number;
  index: number; // upset potential, 0..1 (the underdog's outright-win probability)
  kind: UpsetKind;
  stake: UpsetStake | null; // set when the viewer backed one of these teams
}

// The upset metric is the underdog's *outright-win* probability — deliberately
// draw-blind, since "upset" here means the favorite is beaten, not held. So a
// draw-heavy fixture (e.g. 0.40 / 0.35 / 0.25) reads as a fragile-favorite alert,
// not a toss-up. Below UPSET_FLOOR the underdog can't realistically win → chalk,
// dropped. Within TOSSUP_MARGIN of the favorite it's billed a toss-up.
const UPSET_FLOOR = 0.2;
const TOSSUP_MARGIN = 0.12;
const DEFAULT_LIMIT = 4;

// The teams the viewer has a rooting interest in: their group winners and their
// finalists + champion. An upset to any of these is what makes the radar personal.
export function stakedTeamCodes(picks: Picks): Set<string> {
  const codes = new Set<string>();
  for (const code of Object.values(picks.groupFirst)) if (code) codes.add(code);
  for (const slot of [101, 102, 104]) {
    const code = picks.knockout[slot];
    if (code) codes.add(code);
  }
  return codes;
}

// Valid three-way probabilities that actually sum to ~1 (guards against half-
// populated odds rows reaching the math).
function hasUsableOdds(p: ImpliedProbs | null): p is ImpliedProbs {
  if (!p) return false;
  const sum = p.homeWinProb + p.drawProb + p.awayWinProb;
  return sum > 0.99 && sum < 1.01;
}

// Rank upcoming matches by upset potential (underdog win probability), keeping
// only live-but-minority underdogs, tagging the viewer's stake, capped to `limit`.
export function buildUpsetRadar(
  matches: UpsetMatchInput[],
  staked: Set<string> = new Set(),
  limit: number = DEFAULT_LIMIT,
): UpsetRow[] {
  const rows: UpsetRow[] = [];

  for (const m of matches) {
    if (!m.homeCode || !m.awayCode || !hasUsableOdds(m.odds)) continue;
    const { homeWinProb, drawProb, awayWinProb } = m.odds;

    // Favorite is the higher win-prob; ties resolve to home deterministically.
    const homeIsFavorite = homeWinProb >= awayWinProb;
    const favorite: UpsetSide = homeIsFavorite
      ? { code: m.homeCode, name: teamName(m.homeCode), winProb: homeWinProb }
      : { code: m.awayCode, name: teamName(m.awayCode), winProb: awayWinProb };
    const underdog: UpsetSide = homeIsFavorite
      ? { code: m.awayCode, name: teamName(m.awayCode), winProb: awayWinProb }
      : { code: m.homeCode, name: teamName(m.homeCode), winProb: homeWinProb };

    const index = underdog.winProb;
    if (index < UPSET_FLOOR) continue;

    const kind: UpsetKind = favorite.winProb - underdog.winProb <= TOSSUP_MARGIN ? "tossup" : "upsetAlert";

    let stake: UpsetStake | null = null;
    if (staked.has(favorite.code)) stake = { code: favorite.code, side: "favorite" };
    else if (staked.has(underdog.code)) stake = { code: underdog.code, side: "underdog" };

    rows.push({ matchNo: m.matchNo, scheduledAt: m.scheduledAt, favorite, underdog, drawProb, index, kind, stake });
  }

  rows.sort((a, b) => b.index - a.index || a.matchNo - b.matchNo);
  return rows.slice(0, limit);
}
