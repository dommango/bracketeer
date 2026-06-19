// Odds poller: fetches h2h prices from The Odds API, maps events to internal
// matchNos, and upserts MatchOdds. Safe no-op when ODDS_API_KEY is not set.

import { prisma } from "@/lib/db";
import { oddsApiEnabled } from "@/lib/env";
import { fetchOddsEvents } from "@/lib/odds/client";
import { normalizeTeam, resolveMatchNo, toImpliedProbs, orientToHome } from "@/lib/odds/map";
import { loadCodedMatches } from "@/lib/odds/coded";
import { snapshotDue, snapshotKickoffRange, type OddsSnapshot } from "@/lib/odds/schedule";

export interface OddsPollSummary {
  fetched: number;
  mapped: number;
  upserted: number;
  unmatched: string[];
  skipped?: boolean; // gate decided this poll shouldn't spend an Odds API credit
  snapshot?: OddsSnapshot; // why: which snapshot (pre/half) this fetch is taking
}

// Decide whether this poll should spend a credit. Cron calls poll-odds every
// minute; this lets a call through only when some match is at a snapshot moment
// whose odds haven't been captured yet (see lib/odds/schedule.ts) — bounding h2h
// spend to ~2 credits per distinct kickoff to stay inside the 500/mo free quota.
// The whole-slate fetch refreshes every match at once, so the first match to hit a
// shared kickoff covers the rest, and `snapshotDue` then reports them not due.
async function oddsRefreshDue(
  tournamentId: string,
): Promise<{ due: boolean; snapshot: OddsSnapshot | null }> {
  const now = Date.now();
  const candidates = await prisma.match.findMany({
    where: { tournamentId, scheduledAt: snapshotKickoffRange(now) },
    select: { scheduledAt: true, odds: { select: { fetchedAt: true } } },
  });

  for (const m of candidates) {
    const snap = snapshotDue(
      now,
      m.scheduledAt!.getTime(),
      m.odds?.fetchedAt?.getTime() ?? null,
    );
    if (snap) return { due: true, snapshot: snap };
  }
  return { due: false, snapshot: null };
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
    return { fetched: 0, mapped: 0, upserted: 0, unmatched: [], skipped: true };
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

  return { fetched: events.length, mapped, upserted, unmatched, snapshot: plan.snapshot ?? undefined };
}
