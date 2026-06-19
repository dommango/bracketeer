// Odds poller: fetches h2h prices from The Odds API, maps events to internal
// matchNos, and upserts MatchOdds. Safe no-op when ODDS_API_KEY is not set.

import { prisma } from "@/lib/db";
import { oddsApiEnabled } from "@/lib/env";
import { fetchOddsEvents } from "@/lib/odds/client";
import { normalizeTeam, resolveMatchNo, toImpliedProbs, orientToHome } from "@/lib/odds/map";
import { loadCodedMatches } from "@/lib/odds/coded";
import {
  oddsTier,
  maxAgeForTier,
  oddsFetchDue,
  type OddsTier,
  LIVE_WINDOW_BEFORE_MS,
  LIVE_WINDOW_AFTER_MS,
  PREMATCH_LOOKAHEAD_MS,
} from "@/lib/odds/schedule";

export interface OddsPollSummary {
  fetched: number;
  mapped: number;
  upserted: number;
  unmatched: string[];
  skipped?: boolean; // gate decided this poll shouldn't spend an Odds API credit
  tier?: OddsTier; // why: which cadence tier the schedule resolved to
}

// Decide whether this poll should spend a credit. Mirrors pollScores' shouldPollNow
// but adds a staleness gate: cron calls poll-odds every minute, and this lets the
// call through only when the stored odds are stale for the current tier — frequent
// while a match is live, slow pre-match, never when idle. The whole-slate fetch is
// 1 credit, so gating *frequency* here is the entire credit-budget lever.
async function oddsRefreshDue(tournamentId: string): Promise<{ due: boolean; tier: OddsTier }> {
  const now = Date.now();

  const liveNow =
    (await prisma.match.findFirst({
      where: {
        tournamentId,
        scheduledAt: {
          gt: new Date(now - LIVE_WINDOW_AFTER_MS),
          lt: new Date(now + LIVE_WINDOW_BEFORE_MS),
        },
      },
      select: { id: true },
    })) != null;

  let imminent = false;
  if (!liveNow) {
    imminent =
      (await prisma.match.findFirst({
        where: {
          tournamentId,
          scored: false,
          scheduledAt: {
            gt: new Date(now + LIVE_WINDOW_BEFORE_MS),
            lt: new Date(now + PREMATCH_LOOKAHEAD_MS),
          },
        },
        select: { id: true },
      })) != null;
  }

  const tier = oddsTier(liveNow, imminent);
  const maxAge = maxAgeForTier(tier);
  if (maxAge == null) return { due: false, tier };

  const freshest = await prisma.matchOdds.findFirst({
    where: { match: { tournamentId } },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });
  return { due: oddsFetchDue(freshest?.fetchedAt ?? null, maxAge, now), tier };
}

export async function pollOdds(): Promise<OddsPollSummary> {
  if (!oddsApiEnabled) return { fetched: 0, mapped: 0, upserted: 0, unmatched: [] };

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true, officialResults: true },
  });
  if (!tournament) return { fetched: 0, mapped: 0, upserted: 0, unmatched: [] };

  const plan = await oddsRefreshDue(tournament.id);
  if (!plan.due) {
    return { fetched: 0, mapped: 0, upserted: 0, unmatched: [], skipped: true, tier: plan.tier };
  }

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
    // The provider's home/away may be flipped vs our fixture (neutral venues), so
    // reorient the probs to our coded home before storing — the UI reads
    // homeWinProb as our home team's chance.
    const codedMatch = coded.find((m) => m.matchNo === matchNo)!;
    const probs = orientToHome(
      toImpliedProbs(ev.decimalHome, ev.decimalDraw, ev.decimalAway),
      home,
      codedMatch.homeCode,
    );
    const matchId = idByMatchNo.get(matchNo)!;
    await prisma.matchOdds.upsert({
      where: { matchId },
      update: { ...probs, raw: ev as object, source: "the-odds-api", fetchedAt: new Date() },
      create: { matchId, ...probs, raw: ev as object, source: "the-odds-api", fetchedAt: new Date() },
    });
    upserted++;
  }

  return { fetched: events.length, mapped, upserted, unmatched, tier: plan.tier };
}
