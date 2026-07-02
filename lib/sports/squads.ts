// Squads poller: per-team roster from /players/squads. One call per team (keyed by
// the fixtures-map provider id → our code), upserted by team code. Team-isolated so
// one failure doesn't lose the rest; skips an empty roster so a bad fetch never wipes
// a good one. Rosters are static once named, so it runs daily. No-op without
// SPORTS_API_KEY.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchSquad } from "@/lib/sports/client";
import { parseSquad } from "@/lib/sports/squad-parse";
import { EXTERNAL_TEAM_CODES } from "@/lib/sports/fixtures-map";

export interface SquadsPollSummary {
  teams: number;
  stored: number;
}

export async function pollSquads(now: Date = new Date()): Promise<SquadsPollSummary> {
  if (!sportsApiEnabled) return { teams: 0, stored: 0 };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return { teams: 0, stored: 0 };

  const teams = Object.entries(EXTERNAL_TEAM_CODES);
  let stored = 0;

  for (const [externalId, teamCode] of teams) {
    try {
      const raw = await fetchSquad(Number(externalId));
      const players = parseSquad(raw);
      if (players.length === 0) continue; // not named yet / bad fetch → keep last-known

      const data = { players: players as object, raw: raw as object, fetchedAt: now };
      await prisma.teamSquad.upsert({
        where: { tournamentId_teamCode: { tournamentId: tournament.id, teamCode } },
        update: data,
        create: { tournamentId: tournament.id, teamCode, ...data },
      });
      stored += 1;
    } catch (err) {
      console.error(`squads: ${teamCode} (${externalId}) failed:`, err);
    }
  }

  return { teams: teams.length, stored };
}
