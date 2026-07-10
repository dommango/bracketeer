// Per-event "props" poller: fetches BTTS + anytime-goalscorer for matches at a
// snapshot moment via The Odds API per-event endpoint, and persists MatchProps +
// MatchScorerOdds. Safe no-op when ODDS_API_KEY is unset.
//
// Credit shape (why this is gated, not interval-polled): the per-event endpoint is
// billed per event — markets=btts,player_goal_scorer_anytime = 2 credits per match
// per call — unlike the featured whole-slate markets (1 credit covers every match).
// So we spend only at fixed snapshot moments (just before kickoff + around halftime,
// see lib/odds/schedule.ts), bounding props spend to ~4 credits per distinct kickoff.
// Unlike the h2h poll we pass `skipEarly` to snapshotDue: the free whole-slate h2h
// can afford the 18-h early snapshot, but here it would be a full per-match charge
// 18 h out, so props capture only pre + half. When no match is at a snapshot moment
// the poll makes ZERO API calls (one indexed query, then returns), like poll-odds.

import { prisma } from "@/lib/db";
import { oddsApiEnabled } from "@/lib/env";
import { fetchEventList, fetchEventMarkets } from "@/lib/odds/client";
import { normalizeTeam, resolveMatchNo, toTwoWayProbs, toScorerProbs } from "@/lib/odds/map";
import { loadCodedMatches } from "@/lib/odds/coded";
import { snapshotDue, snapshotKickoffRange } from "@/lib/odds/schedule";
import { quotaExhausted, quotaSnapshot } from "@/lib/odds/quota";

export interface MatchPropsSummary {
  dueMatches: number;
  eventsListed: number;
  bttsUpserted: number;
  scorersUpserted: number;
  unmatched: string[]; // due matches we couldn't resolve to an Odds API event id
  skipped?: boolean; // no match at a snapshot moment → no API call made
  quotaBlocked?: boolean; // remaining Odds API credits below the floor → held off
}

interface DueMatch {
  matchNo: number;
  matchId: string;
}

// Matches whose props snapshot is due right now (gated like the h2h poll, but on
// MatchProps.fetchedAt so it fires independently). Empty list → nothing to fetch.
async function duePropMatches(tournamentId: string): Promise<DueMatch[]> {
  const now = Date.now();
  const candidates = await prisma.match.findMany({
    where: { tournamentId, scheduledAt: snapshotKickoffRange(now) },
    select: { id: true, matchNo: true, scheduledAt: true, props: { select: { fetchedAt: true } } },
  });

  const due: DueMatch[] = [];
  for (const m of candidates) {
    // skipEarly: props skip the 18-h early snapshot (it's a per-match charge here).
    if (snapshotDue(now, m.scheduledAt!.getTime(), m.props?.fetchedAt?.getTime() ?? null, { skipEarly: true })) {
      due.push({ matchNo: m.matchNo, matchId: m.id });
    }
  }
  return due;
}

export async function pollMatchProps(): Promise<MatchPropsSummary> {
  const empty: MatchPropsSummary = {
    dueMatches: 0,
    eventsListed: 0,
    bttsUpserted: 0,
    scorersUpserted: 0,
    unmatched: [],
  };
  if (!oddsApiEnabled) return empty;

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true, officialResults: true },
  });
  if (!tournament) return empty;

  const due = await duePropMatches(tournament.id);
  if (due.length === 0) return { ...empty, skipped: true };

  // Hard stop: the per-event endpoint is the priciest poll (2 credits/match). If the
  // last known remaining credits are below the floor, hold off entirely rather than
  // drain the last of the quota — the props board is the most expendable feature.
  if (quotaExhausted()) {
    console.warn(`[odds] props poll held: quota below floor (${quotaSnapshot().remaining} left)`);
    return { ...empty, dueMatches: due.length, skipped: true, quotaBlocked: true };
  }

  // Resolve each due match to The Odds API event id via the free /events listing
  // (0 credits), so a credit is spent only on events we actually want.
  const coded = await loadCodedMatches(tournament.id, tournament.officialResults);
  const events = await fetchEventList();
  const eventIdByMatchNo = new Map<number, string>();
  for (const ev of events) {
    const home = normalizeTeam(ev.homeName);
    const away = normalizeTeam(ev.awayName);
    if (!home || !away) continue;
    const matchNo = resolveMatchNo(home, away, coded);
    if (matchNo != null) eventIdByMatchNo.set(matchNo, ev.id);
  }

  const summary: MatchPropsSummary = { ...empty, dueMatches: due.length, eventsListed: events.length };

  for (const m of due) {
    const eventId = eventIdByMatchNo.get(m.matchNo);
    if (!eventId) {
      summary.unmatched.push(`match ${m.matchNo}`);
      continue;
    }
    try {
      const { btts, scorers } = await fetchEventMarkets(eventId);
      const now = new Date();

      // BTTS lives in its own row (one per match) — upsert it; its fetchedAt is the
      // gate above, so always stamp it even when the market itself was empty.
      const bttsProbs = btts ? toTwoWayProbs(btts.decimalYes, btts.decimalNo) : null;
      await prisma.matchProps.upsert({
        where: { matchId: m.matchId },
        update: {
          bttsYesProb: bttsProbs?.overProb ?? null,
          bttsNoProb: bttsProbs?.underProb ?? null,
          source: "the-odds-api",
          fetchedAt: now,
        },
        create: {
          matchId: m.matchId,
          bttsYesProb: bttsProbs?.overProb ?? null,
          bttsNoProb: bttsProbs?.underProb ?? null,
          source: "the-odds-api",
          fetchedAt: now,
        },
      });
      if (bttsProbs) summary.bttsUpserted++;

      // Scorers: replace this match's board wholesale so a player dropped from the
      // market doesn't linger. Skip the delete+create when the market came back
      // empty (a bad/partial fetch) so we keep the last-known board.
      const scorerProbs = toScorerProbs(scorers);
      if (scorerProbs.length > 0) {
        await prisma.$transaction([
          prisma.matchScorerOdds.deleteMany({ where: { matchId: m.matchId } }),
          prisma.matchScorerOdds.createMany({
            data: scorerProbs.map((p) => ({
              matchId: m.matchId,
              playerName: p.playerName,
              scoreProb: p.scoreProb,
              decimal: p.decimal,
              source: "the-odds-api",
              fetchedAt: now,
            })),
          }),
        ]);
        summary.scorersUpserted += scorerProbs.length;
      }
    } catch (err) {
      // Isolate per-match: one event's failure must not lose the others' writes.
      console.error(`match props: event ${eventId} (match ${m.matchNo}) failed:`, err);
    }
  }

  return summary;
}
