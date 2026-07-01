// Player-profiles poller: sweeps the paginated /players list for the tournament and
// upserts a PlayerProfile per player (keyed by provider id). Upsert (not wholesale
// replace) so a partial sweep never wipes the board. Bounded page cap as a runaway
// guard. Slow-moving bio/stat data, so it runs daily. No-op without SPORTS_API_KEY.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchPlayersPage } from "@/lib/sports/client";
import { parsePlayers } from "@/lib/sports/players-parse";

export interface PlayersPollSummary {
  pages: number;
  stored: number;
}

// Safety ceiling on pages swept in one run (20 players/page → 2000 players). The
// real page count comes from the API's paging.total; this only caps a runaway.
const MAX_PAGES = 100;

export async function pollPlayers(now: Date = new Date()): Promise<PlayersPollSummary> {
  if (!sportsApiEnabled) return { pages: 0, stored: 0 };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return { pages: 0, stored: 0 };

  let stored = 0;
  let pagesSwept = 0;
  let totalPages = 1;

  for (let page = 1; page <= totalPages && page <= MAX_PAGES; page++) {
    let entries;
    try {
      const res = await fetchPlayersPage(page);
      totalPages = res.totalPages;
      entries = parsePlayers(res.players);
    } catch (err) {
      // One bad page shouldn't abort the sweep — skip it and continue.
      console.error(`players: page ${page} failed:`, err);
      continue;
    }
    pagesSwept += 1;

    for (const e of entries) {
      const data = {
        playerName: e.playerName,
        teamCode: e.teamCode,
        firstName: e.firstName,
        lastName: e.lastName,
        age: e.age,
        nationality: e.nationality,
        height: e.height,
        position: e.position,
        photoUrl: e.photoUrl,
        appearances: e.appearances,
        minutes: e.minutes,
        goals: e.goals,
        assists: e.assists,
        shots: e.shots,
        rating: e.rating,
        yellowCards: e.yellowCards,
        redCards: e.redCards,
        raw: e.source as object,
        fetchedAt: now,
      };
      try {
        await prisma.playerProfile.upsert({
          where: { tournamentId_externalId: { tournamentId: tournament.id, externalId: e.externalId } },
          update: data,
          create: { tournamentId: tournament.id, externalId: e.externalId, ...data },
        });
        stored += 1;
      } catch (err) {
        console.error(`players: upsert ${e.playerName} (${e.externalId}) failed:`, err);
      }
    }
  }

  return { pages: pagesSwept, stored };
}
