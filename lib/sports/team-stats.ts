// Team-stats poller: per-team tournament form / record from /teams/statistics.
// One call per team (keyed by the provider team id from the fixtures map), upserted
// by team code. Each team is isolated so one failure doesn't lose the rest, and an
// empty parse is skipped so a bad fetch never wipes a good row. Slow-moving data, so
// it runs daily. No-op without SPORTS_API_KEY.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchTeamStatistics } from "@/lib/sports/client";
import { parseTeamStatistics } from "@/lib/sports/team-stats-parse";
import { EXTERNAL_TEAM_CODES } from "@/lib/sports/fixtures-map";

export interface TeamStatsPollSummary {
  teams: number; // teams attempted
  stored: number; // rows upserted
}

export async function pollTeamStats(now: Date = new Date()): Promise<TeamStatsPollSummary> {
  if (!sportsApiEnabled) return { teams: 0, stored: 0 };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return { teams: 0, stored: 0 };

  // One entry per provider team id → our code (the fixtures map is id-keyed).
  const teams = Object.entries(EXTERNAL_TEAM_CODES);
  let stored = 0;

  for (const [externalId, teamCode] of teams) {
    try {
      const raw = await fetchTeamStatistics(Number(externalId));
      const s = parseTeamStatistics(raw);
      if (!s) continue; // no games yet / bad fetch → keep last-known

      const data = {
        played: s.played,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        cleanSheets: s.cleanSheets,
        failedToScore: s.failedToScore,
        form: s.form,
        raw: (raw ?? {}) as object,
        fetchedAt: now,
      };
      await prisma.teamStat.upsert({
        where: { tournamentId_teamCode: { tournamentId: tournament.id, teamCode } },
        update: data,
        create: { tournamentId: tournament.id, teamCode, ...data },
      });
      stored += 1;
    } catch (err) {
      console.error(`team stats: ${teamCode} (${externalId}) failed:`, err);
    }
  }

  return { teams: teams.length, stored };
}
