// Pick-split aggregation: "62% of the pool picked Brazil here." Read-only —
// aggregates the locked Pick rows across every entry in a pool. Pick columns
// mirror the long-format CSV exactly (section/category/key/code/teamOrValue), so
// knockout winner picks are just rows with category `M{n}` and key `winner_pick`;
// no decoding is needed for the counts.

import { prisma } from "@/lib/db";
import { TEAMS } from "@/lib/scoring/data";
import { resolveBracket } from "@/lib/pool/bracket";
import { getPoolAnswerKey } from "@/lib/pool/queries";
import { roundLabel, roundPoints } from "@/lib/pool/rounds";
import { tallyShares, type PickShare } from "@/lib/pool/pickShares";

export interface MatchPickSplit {
  matchNo: number;
  roundLabel: string;
  points: number; // what a correct winner pick is worth
  homeCode: string | null;
  awayCode: string | null;
  homeName: string;
  awayName: string;
  winnerCode: string | null; // actual recorded winner, or null if undecided
  decided: boolean;
  totalPicks: number; // entries that picked a winner for this match
  shares: PickShare[]; // every picked team, most-picked first
}

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "TBD";

// The distribution of picked winners for one knockout match across the pool.
export async function getMatchPickSplit(
  poolId: string,
  matchNo: number,
): Promise<MatchPickSplit | null> {
  const ctx = await getPoolAnswerKey(poolId);
  if (!ctx) return null;
  const { results, cfg } = ctx;

  const resolved = resolveBracket(results)[matchNo] ?? { home: null, away: null, winner: null };

  const picks = await prisma.pick.findMany({
    where: { entry: { poolId }, category: `M${matchNo}`, key: "winner_pick", code: { not: "" } },
    select: { code: true, entry: { select: { label: true } } },
  });

  const { totalPicks, shares } = tallyShares(
    picks.map((p) => ({ code: p.code, label: p.entry.label })),
    resolved,
  );

  return {
    matchNo,
    roundLabel: roundLabel(matchNo),
    points: roundPoints(matchNo, cfg),
    homeCode: resolved.home,
    awayCode: resolved.away,
    homeName: teamName(resolved.home),
    awayName: teamName(resolved.away),
    winnerCode: resolved.winner,
    decided: Boolean(resolved.winner),
    totalPicks,
    shares,
  };
}

// Pool-wide knockout pick counts keyed by matchNo → (teamCode → count). Used by
// the entry profile to find a "boldest call" (a correct, low-ownership pick)
// without issuing a query per match.
export async function getPoolKnockoutShares(
  poolId: string,
): Promise<{ counts: Map<number, Map<string, number>>; totals: Map<number, number> }> {
  const picks = await prisma.pick.findMany({
    where: { entry: { poolId }, key: "winner_pick", code: { not: "" } },
    select: { category: true, code: true },
  });

  const counts = new Map<number, Map<string, number>>();
  const totals = new Map<number, number>();
  for (const p of picks) {
    const m = /^M(\d+)$/.exec(p.category);
    if (!m) continue;
    const matchNo = Number(m[1]);
    const inner = counts.get(matchNo) ?? new Map<string, number>();
    inner.set(p.code, (inner.get(p.code) ?? 0) + 1);
    counts.set(matchNo, inner);
    totals.set(matchNo, (totals.get(matchNo) ?? 0) + 1);
  }
  return { counts, totals };
}
