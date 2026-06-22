// Read model for the Match Day 3 Pickem UI: the 24 fixtures decorated with team
// names, the viewer's prediction, the live/final result (oriented to the fixture's
// canonical home/away by team code), per-match lock state, and points earned.

import { prisma } from "@/lib/db";
import { TEAMS } from "@/lib/scoring/data";
import {
  md3Fixtures,
  MD3_MATCH_NOS,
  isMd3MatchLocked,
  scoreMd3,
} from "@/lib/pool/match-day-3";
import { getMd3Entry } from "@/lib/pool/md3-picks";

export interface Md3FixtureVM {
  matchNo: number;
  group: string;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  kickoffISO: string;
  locked: boolean;
  pred: { home: number; away: number } | null;
  result: { home: number; away: number; final: boolean } | null;
  points: number | null;
}

export interface Md3View {
  fixtures: Md3FixtureVM[];
  totalPoints: number;
  scoredCount: number;
  pickedCount: number;
  openCount: number;
}

export async function getMd3View(
  tournamentId: string,
  poolId: string,
  userId: string | null,
  now: Date = new Date(),
): Promise<Md3View> {
  const fixtures = md3Fixtures();

  const [resultRows, entry] = await Promise.all([
    prisma.result.findMany({
      where: { match: { tournamentId, matchNo: { in: [...MD3_MATCH_NOS] } } },
      select: {
        homeTeamCode: true,
        awayTeamCode: true,
        homeScore: true,
        awayScore: true,
        status: true,
        match: { select: { matchNo: true } },
      },
    }),
    userId ? getMd3Entry(poolId, userId) : Promise.resolve(null),
  ]);

  // Map matchNo → { teamCode: goals, final }.
  const byNo = new Map<number, { byTeam: Record<string, number>; final: boolean }>();
  for (const r of resultRows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore === null || r.awayScore === null) continue;
    byNo.set(r.match.matchNo, {
      byTeam: { [r.homeTeamCode]: r.homeScore, [r.awayTeamCode]: r.awayScore },
      final: r.status === "FINAL",
    });
  }

  const preds = entry?.scores ?? {};

  let totalPoints = 0;
  let scoredCount = 0;
  let pickedCount = 0;
  let openCount = 0;

  const vms: Md3FixtureVM[] = fixtures.map((f) => {
    const locked = isMd3MatchLocked(f.matchNo, now);
    if (!locked) openCount += 1;

    const pred = preds[f.matchNo] ?? null;
    if (pred) pickedCount += 1;

    const r = byNo.get(f.matchNo);
    let result: Md3FixtureVM["result"] = null;
    if (r) {
      result = {
        home: r.byTeam[f.homeCode] ?? 0,
        away: r.byTeam[f.awayCode] ?? 0,
        final: r.final,
      };
      if (r.final) scoredCount += 1;
    }

    let points: number | null = null;
    if (result?.final && pred) {
      points = scoreMd3(pred, { home: result.home, away: result.away });
      totalPoints += points;
    }

    return {
      matchNo: f.matchNo,
      group: f.group,
      homeCode: f.homeCode,
      awayCode: f.awayCode,
      homeName: TEAMS[f.homeCode] ?? f.homeCode,
      awayName: TEAMS[f.awayCode] ?? f.awayCode,
      kickoffISO: f.kickoff.toISOString(),
      locked,
      pred,
      result,
      points,
    };
  });

  return { fixtures: vms, totalPoints, scoredCount, pickedCount, openCount };
}
