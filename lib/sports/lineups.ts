// Lineups poller: pulls API-Football /fixtures/lineups (starting XI + formation)
// for fixtures near kickoff and upserts MatchLineup. Lineups publish ~1h before KO
// and don't change afterward, so this targets a small near-KO window AND skips
// fixtures that already have a stored lineup — each fixture costs ~one real fetch.
// Safe no-op when SPORTS_API_KEY is not configured.

import { prisma } from "@/lib/db";
import { sportsApiEnabled } from "@/lib/env";
import { fetchLineups } from "@/lib/sports/client";
import { parseLineups, assignSides } from "@/lib/sports/lineups-parse";
import { loadCodedMatches } from "@/lib/odds/coded";

export interface LineupsPollSummary {
  considered: number;
  stored: number;
  pending: number; // near KO but lineups not published yet
  unresolved: number; // published but we couldn't safely map the two sides
}

const WINDOW_AHEAD_MS = 2 * 60 * 60 * 1000; // pre-kickoff (lineups out ~1h before)
const WINDOW_BEHIND_MS = 2 * 60 * 60 * 1000; // in-play, in case we missed pre-KO
const MAX_PER_RUN = 8;

export async function pollLineups(now: Date = new Date()): Promise<LineupsPollSummary> {
  const empty = { considered: 0, stored: 0, pending: 0, unresolved: 0 };
  if (!sportsApiEnabled) return empty;

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true, officialResults: true },
  });
  if (!tournament) return empty;

  // Resolve every fixture's home/away 3-letter codes (group teams from slots/results,
  // knockout teams from the resolved bracket) — the same bridge the odds poller uses.
  const coded = await loadCodedMatches(tournament.id, tournament.officialResults);
  const codesByMatchId = new Map(coded.map((c) => [c.matchId, c]));

  // Near-kickoff fixtures with a provider id that don't yet have a stored lineup.
  const matches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      externalRef: { not: null },
      lineup: { is: null },
      scheduledAt: {
        gte: new Date(now.getTime() - WINDOW_BEHIND_MS),
        lte: new Date(now.getTime() + WINDOW_AHEAD_MS),
      },
    },
    select: { id: true, externalRef: true },
    orderBy: { scheduledAt: "asc" },
    take: MAX_PER_RUN,
  });

  let stored = 0;
  let pending = 0;
  let unresolved = 0;
  for (const m of matches) {
    const fixtureId = Number(m.externalRef);
    if (!Number.isFinite(fixtureId)) continue;
    try {
      const raw = await fetchLineups(fixtureId);
      const teams = parseLineups(raw);
      if (teams.length < 2) {
        pending++; // not published yet — retry on a later run
        continue;
      }
      const codes = codesByMatchId.get(m.id);
      const sides = assignSides(teams, codes?.homeCode ?? null, codes?.awayCode ?? null);
      if (!sides) {
        unresolved++; // can't map the two sides safely — never guess by order
        continue;
      }

      const data = {
        homeFormation: sides.home.formation,
        awayFormation: sides.away.formation,
        home: sides.home.players as object,
        away: sides.away.players as object,
        raw: raw as object,
        fetchedAt: now,
      };
      await prisma.matchLineup.upsert({
        where: { matchId: m.id },
        update: data,
        create: { matchId: m.id, ...data },
      });
      stored++;
    } catch (err) {
      console.error(`lineups: fixture ${fixtureId} failed:`, err);
    }
  }

  return { considered: matches.length, stored, pending, unresolved };
}
