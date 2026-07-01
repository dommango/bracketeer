// Stat-leaders poller: the assist + disciplinary boards. Each /players/top* call
// returns a whole ranked board, replaced wholesale per category (one transaction)
// so players who slip down or drop off don't linger. Skip a category on an empty
// parse so a bad fetch never wipes its last-known board. Each category is isolated
// so one failing board doesn't lose the others. Cheap (3 calls), runs hourly like
// topscorers. No-op without SPORTS_API_KEY.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchTopAssists, fetchTopYellowCards, fetchTopRedCards } from "@/lib/sports/client";
import { parseStatLeaders, type StatCategory } from "@/lib/sports/stat-leaders-parse";
import type { ApiStatLeader } from "@/lib/sports/stat-leaders-parse";

export interface StatLeadersPollSummary {
  assists: number;
  yellowCards: number;
  redCards: number;
}

const FETCHERS: Record<StatCategory, () => Promise<ApiStatLeader[]>> = {
  ASSISTS: fetchTopAssists,
  YELLOW_CARDS: fetchTopYellowCards,
  RED_CARDS: fetchTopRedCards,
};

export async function pollStatLeaders(now: Date = new Date()): Promise<StatLeadersPollSummary> {
  const summary: StatLeadersPollSummary = { assists: 0, yellowCards: 0, redCards: 0 };
  if (!sportsApiEnabled) return summary;

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return summary;

  const counts: Record<StatCategory, keyof StatLeadersPollSummary> = {
    ASSISTS: "assists",
    YELLOW_CARDS: "yellowCards",
    RED_CARDS: "redCards",
  };

  for (const category of Object.keys(FETCHERS) as StatCategory[]) {
    try {
      const raw = await FETCHERS[category]();
      const entries = parseStatLeaders(raw, category);
      if (entries.length === 0) continue; // don't wipe a good board on a bad fetch

      await prisma.$transaction([
        prisma.statLeader.deleteMany({ where: { tournamentId: tournament.id, category } }),
        prisma.statLeader.createMany({
          data: entries.map((e) => ({
            tournamentId: tournament.id,
            category,
            rank: e.rank,
            playerName: e.playerName,
            teamCode: e.teamCode,
            value: e.value,
            appearances: e.appearances,
            raw: e.source as object,
            fetchedAt: now,
          })),
        }),
      ]);
      summary[counts[category]] = entries.length;
    } catch (err) {
      console.error(`stat leaders: ${category} failed:`, err);
    }
  }

  return summary;
}
