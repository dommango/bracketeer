// Odds poller: fetches h2h prices from The Odds API, maps events to internal
// matchNos, and upserts MatchOdds. Safe no-op when ODDS_API_KEY is not set.

import { prisma } from "@/lib/db";
import { oddsApiEnabled } from "@/lib/env";
import { fetchOddsEvents } from "@/lib/odds/client";
import { normalizeTeam, resolveMatchNo, toImpliedProbs } from "@/lib/odds/map";
import { loadCodedMatches } from "@/lib/odds/coded";

export interface OddsPollSummary {
  fetched: number;
  mapped: number;
  upserted: number;
  unmatched: string[];
}

export async function pollOdds(): Promise<OddsPollSummary> {
  if (!oddsApiEnabled) return { fetched: 0, mapped: 0, upserted: 0, unmatched: [] };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true, officialResults: true },
  });
  if (!tournament) return { fetched: 0, mapped: 0, upserted: 0, unmatched: [] };

  const coded = await loadCodedMatches(tournament.id, tournament.officialResults);
  const idByMatchNo = new Map<number, string>();
  for (const m of coded) idByMatchNo.set(m.matchNo, m.matchId);

  const events = await fetchOddsEvents();
  let mapped = 0;
  let upserted = 0;
  const unmatched: string[] = [];

  for (const ev of events) {
    const home = normalizeTeam(ev.homeName);
    const away = normalizeTeam(ev.awayName);
    if (!home || !away) {
      unmatched.push(`${ev.homeName} v ${ev.awayName}`);
      continue;
    }
    const matchNo = resolveMatchNo(home, away, coded);
    if (matchNo == null) {
      unmatched.push(`${home} v ${away}`);
      continue;
    }
    mapped++;
    const probs = toImpliedProbs(ev.decimalHome, ev.decimalDraw, ev.decimalAway);
    const matchId = idByMatchNo.get(matchNo)!;
    await prisma.matchOdds.upsert({
      where: { matchId },
      update: { ...probs, raw: ev as object, source: "the-odds-api", fetchedAt: new Date() },
      create: { matchId, ...probs, raw: ev as object, source: "the-odds-api", fetchedAt: new Date() },
    });
    upserted++;
  }

  return { fetched: events.length, mapped, upserted, unmatched };
}
