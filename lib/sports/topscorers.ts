// Top-scorers poller: one /players/topscorers call returns the whole ranked board,
// which we replace wholesale (one transaction) so players who slip down or drop off
// don't linger. Skip on an empty parse so a bad fetch never wipes the last-known
// board. Cheap (single call), so it runs hourly. No-op without SPORTS_API_KEY.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchTopScorers } from "@/lib/sports/client";
import { parseTopScorers } from "@/lib/sports/topscorers-parse";

export interface TopScorersPollSummary {
  fetched: number;
  stored: number;
}

export async function pollTopScorers(now: Date = new Date()): Promise<TopScorersPollSummary> {
  if (!sportsApiEnabled) return { fetched: 0, stored: 0 };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return { fetched: 0, stored: 0 };

  const raw = await fetchTopScorers();
  const entries = parseTopScorers(raw);
  if (entries.length === 0) return { fetched: raw.length, stored: 0 };

  await prisma.$transaction([
    prisma.topScorer.deleteMany({ where: { tournamentId: tournament.id } }),
    prisma.topScorer.createMany({
      data: entries.map((e) => ({
        tournamentId: tournament.id,
        rank: e.rank,
        playerName: e.playerName,
        teamCode: e.teamCode,
        goals: e.goals,
        assists: e.assists,
        appearances: e.appearances,
        raw: e.source as object, // original provider row, for audit / re-derivation
        fetchedAt: now,
      })),
    }),
  ]);

  return { fetched: raw.length, stored: entries.length };
}
