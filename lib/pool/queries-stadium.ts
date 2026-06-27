// Stadium-projection read queries, split out of lib/pool/queries.ts. Re-exported
// from there so callers keep importing from "@/lib/pool/queries".

import { prisma } from "@/lib/db";
import type { GroupResultRow } from "@/lib/pool/group-table";
import {
  projectStadiums,
  type RemainingMatch,
  type StadiumProjection,
} from "@/lib/pool/stadium-projection";
import { usableMatchProbs, NEUTRAL_GROUP_PRIOR } from "./query-helpers";

// Monte-Carlo projection of which teams are likely to fill each Round-of-32 slot
// (hence each stadium). FINAL group results are held fixed; every other group
// match is sampled from its live odds (or the neutral prior). Display-only.
// Tournament-scoped so both pools and the standalone/challenge bracket builder
// can use it.
export async function getStadiumProjectionsForTournament(
  tournamentId: string,
): Promise<StadiumProjection[]> {
  const matches = await prisma.match.findMany({
    where: { tournamentId, matchNo: { lte: 72 } },
    select: {
      matchNo: true,
      homeSlotRef: true,
      awaySlotRef: true,
      odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true } },
      result: {
        select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true, status: true },
      },
    },
  });

  const finished: GroupResultRow[] = [];
  const remaining: RemainingMatch[] = [];

  for (const m of matches) {
    // For group matches the result's team codes equal the seeded slot refs, and
    // MatchOdds is stored oriented to that home code (see lib/odds/poll.ts), so
    // odds.homeWinProb lines up with homeCode below — keep these consistent.
    const homeCode = m.result?.homeTeamCode ?? m.homeSlotRef;
    const awayCode = m.result?.awayTeamCode ?? m.awaySlotRef;
    if (!homeCode || !awayCode) continue;

    const res = m.result;
    if (res && res.status === "FINAL" && res.homeScore != null && res.awayScore != null) {
      finished.push({ homeCode, awayCode, homeScore: res.homeScore, awayScore: res.awayScore });
    } else {
      const o = m.odds && usableMatchProbs(m.odds) ? m.odds : NEUTRAL_GROUP_PRIOR;
      remaining.push({
        homeCode,
        awayCode,
        homeWinProb: o.homeWinProb,
        drawProb: o.drawProb,
        awayWinProb: o.awayWinProb,
      });
    }
  }

  return projectStadiums({ finished, remaining });
}

// Pool-scoped wrapper — resolves the pool's tournament, then delegates.
export async function getStadiumProjections(poolId: string): Promise<StadiumProjection[]> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { tournamentId: true },
  });
  if (!pool) return [];
  return getStadiumProjectionsForTournament(pool.tournamentId);
}
