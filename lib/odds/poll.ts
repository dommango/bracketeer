// Odds poller: fetches h2h prices from The Odds API, maps events to internal
// matchNos, and upserts MatchOdds. Safe no-op when ODDS_API_KEY is not set.

import { prisma } from "@/lib/db";
import { oddsApiEnabled } from "@/lib/env";
import { fetchOddsEvents } from "@/lib/odds/client";
import { normalizeTeam, resolveMatchNo, toImpliedProbs, type CodedMatch } from "@/lib/odds/map";
import { resolveBracket } from "@/lib/pool/bracket";
import { asResults } from "@/lib/pool/scoring";

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

  const resolved = resolveBracket(asResults(tournament.officialResults));

  const rows = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    select: {
      id: true,
      matchNo: true,
      roundCode: true,
      homeSlotRef: true,
      awaySlotRef: true,
      result: { select: { homeTeamCode: true, awayTeamCode: true } },
    },
  });

  const idByMatchNo = new Map<number, string>();
  const coded: CodedMatch[] = rows.map((m) => {
    idByMatchNo.set(m.matchNo, m.id);
    const isGroup = m.roundCode === "GROUP";
    const r = resolved[m.matchNo];
    const homeCode = isGroup
      ? (m.result?.homeTeamCode ?? m.homeSlotRef)
      : (m.result?.homeTeamCode ?? r?.home ?? null);
    const awayCode = isGroup
      ? (m.result?.awayTeamCode ?? m.awaySlotRef)
      : (m.result?.awayTeamCode ?? r?.away ?? null);
    return { matchNo: m.matchNo, homeCode, awayCode };
  });

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
