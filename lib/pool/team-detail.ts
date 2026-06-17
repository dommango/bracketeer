// Team drill-down data for the /pool/[code]/teams/[teamCode] page: the team's
// group table, its fixtures, who in the pool backed it, and its title odds. The
// backing logic is the pure, unit-tested team-backers.ts; the rest composes
// already-tested pure libs (computeGroupTables, buildMatchCenter). Does NOT touch
// lib/scoring — display/aggregation only.

import { prisma } from "@/lib/db";
import { computeGroupTables, type GroupResultRow, type GroupTableRow } from "@/lib/pool/group-table";
import { type MatchCenterRow } from "@/lib/pool/match-center";
import { getMatchCenter, getEntriesWithPicks } from "@/lib/pool/queries";
import { teamBackers, type TeamBacker } from "@/lib/pool/team-backers";
import { GROUPS, TEAMS } from "@/lib/scoring/data";
import type { GroupLetter } from "@/lib/scoring/types";

export type { TeamBacker };

export interface TeamDetail {
  code: string;
  name: string;
  group: GroupLetter | null;
  table: GroupTableRow[]; // the team's group table (empty until results land)
  fixtures: MatchCenterRow[];
  backers: TeamBacker[];
  odds: { winProb: number; decimal: number } | null; // title (champion) market
}

// code -> its real group letter, from the static draw.
function teamGroupOf(code: string): GroupLetter | null {
  for (const [g, codes] of Object.entries(GROUPS)) {
    if (codes.includes(code as never)) return g as GroupLetter;
  }
  return null;
}

// One team's drill-down. Returns null for a code that isn't a real tournament team.
export async function getTeamDetail(
  poolId: string,
  tournamentId: string,
  code: string,
): Promise<TeamDetail | null> {
  const name = TEAMS[code];
  if (!name) return null;

  const group = teamGroupOf(code);

  const [resultRows, fixtureSections, entries, oddsRow] = await Promise.all([
    prisma.result.findMany({
      where: {
        status: { in: ["LIVE", "FINAL"] },
        match: { tournamentId, roundCode: "GROUP" },
      },
      select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true },
    }),
    getMatchCenter(poolId, null),
    getEntriesWithPicks(poolId),
    prisma.teamOutright.findUnique({
      where: { tournamentId_teamCode: { tournamentId, teamCode: code } },
      select: { winProb: true, decimal: true },
    }),
  ]);

  const groupRows: GroupResultRow[] = [];
  for (const r of resultRows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore == null || r.awayScore == null) continue;
    groupRows.push({
      homeCode: r.homeTeamCode,
      awayCode: r.awayTeamCode,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    });
  }
  const table = group ? computeGroupTables(groupRows)[group] : [];

  const fixtures = fixtureSections
    .flatMap((s) => s.matches)
    .filter((m) => m.home.code === code || m.away.code === code)
    .sort((a, b) => a.matchNo - b.matchNo);

  return {
    code,
    name,
    group,
    table,
    fixtures,
    backers: teamBackers(entries, code),
    odds: oddsRow ?? null,
  };
}
