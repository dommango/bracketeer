// Injuries poller: pulls API-Football /injuries (injured / suspended players) for
// upcoming fixtures and upserts MatchInjury. Each fixture is ONE call, so this is
// tightly bounded — only fixtures kicking off within the window, capped — and runs
// on a slow cron cadence, well off the every-minute score path. Safe no-op when
// SPORTS_API_KEY is not configured. Mirrors predictions.ts.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchInjuries } from "@/lib/sports/client";
import { parseInjuries } from "@/lib/sports/injuries-parse";

export interface InjuriesPollSummary {
  considered: number;
  skipped: number;
  fetched: number;
  upserted: number;
}

// Only fetch fixtures kicking off within this window (injury news firms up close
// to kickoff) and cap the number per run — both guard the API credit budget.
const WINDOW_AHEAD_MS = 48 * 60 * 60 * 1000;
const WINDOW_BEHIND_MS = 3 * 60 * 60 * 1000; // include in-progress / just-kicked-off
const MAX_PER_RUN = 10;
// A fixture far from kickoff whose injury list is still fresh is skipped — squad
// news barely moves until match week. Within NEAR_KO it refreshes every run.
const NEAR_KO_MS = 6 * 60 * 60 * 1000;
const FRESH_MS = 6 * 60 * 60 * 1000;

export async function pollInjuries(now: Date = new Date()): Promise<InjuriesPollSummary> {
  if (!sportsApiEnabled) return { considered: 0, skipped: 0, fetched: 0, upserted: 0 };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return { considered: 0, skipped: 0, fetched: 0, upserted: 0 };

  const matches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      externalRef: { not: null },
      scheduledAt: {
        gte: new Date(now.getTime() - WINDOW_BEHIND_MS),
        lte: new Date(now.getTime() + WINDOW_AHEAD_MS),
      },
    },
    select: {
      id: true,
      externalRef: true,
      scheduledAt: true,
      injuries: { select: { fetchedAt: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: MAX_PER_RUN,
  });

  let skipped = 0;
  let fetched = 0;
  let upserted = 0;
  for (const m of matches) {
    const fixtureId = Number(m.externalRef);
    if (!Number.isFinite(fixtureId)) continue;

    // Skip far-from-kickoff fixtures whose injury list is still fresh (credit guard).
    const msToKO = (m.scheduledAt?.getTime() ?? 0) - now.getTime();
    const lastFetched = m.injuries?.fetchedAt?.getTime() ?? 0;
    if (m.injuries && msToKO > NEAR_KO_MS && now.getTime() - lastFetched < FRESH_MS) {
      skipped++;
      continue;
    }

    try {
      const resp = await fetchInjuries(fixtureId);
      fetched++;
      const players = parseInjuries(resp);
      const data = { players: players as object, raw: resp as object, fetchedAt: now };
      await prisma.matchInjury.upsert({
        where: { matchId: m.id },
        update: data,
        create: { matchId: m.id, ...data },
      });
      upserted++;
    } catch (err) {
      // One fixture failing must not abort the rest of the batch.
      console.error(`injuries: fixture ${fixtureId} failed:`, err);
    }
  }

  return { considered: matches.length, skipped, fetched, upserted };
}
