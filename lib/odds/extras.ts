// Slow-cadence odds poller: Over/Under totals + Asian-handicap spreads (per match)
// and tournament-winner + top-goalscorer outrights. Run daily, separate from the
// per-minute h2h poll — these markets move slowly and each featured market is billed
// per call, so polling them on the hot path would multiply credit usage. Each is a
// whole-slate call (1 credit). Safe no-op without ODDS_API_KEY.

import { prisma } from "@/lib/db";
import { oddsApiEnabled } from "@/lib/env";
import {
  fetchTotalsEvents,
  fetchSpreadsEvents,
  fetchOutrights,
  fetchGoalscorerOutrights,
} from "@/lib/odds/client";
import {
  normalizeTeam,
  resolveMatchNo,
  toTwoWayProbs,
  toSpreadProbs,
  orientSpreadToHome,
  toOutrightProbs,
  toGoalscorerProbs,
} from "@/lib/odds/map";
import { loadCodedMatches } from "@/lib/odds/coded";
import { extrasPollDue } from "@/lib/odds/schedule";

export interface OddsExtrasSummary {
  // True when the run spent no credits because the last extras poll is recent
  // (see extrasPollDue) — the cron's in-memory daily bucket resets on restart,
  // so this DB-backed guard is what actually bounds the metered spend.
  skipped?: boolean;
  totalsFetched: number;
  totalsUpdated: number;
  spreadsFetched: number;
  spreadsUpdated: number;
  outrightsFetched: number;
  outrightsUpserted: number;
  goalscorersFetched: number;
  goalscorersUpserted: number;
}

// Each market is isolated: a failure fetching outrights must not lose the totals
// already written (and vice-versa). The caller logs the summary.
export async function pollOddsExtras(): Promise<OddsExtrasSummary> {
  const summary: OddsExtrasSummary = {
    totalsFetched: 0,
    totalsUpdated: 0,
    spreadsFetched: 0,
    spreadsUpdated: 0,
    outrightsFetched: 0,
    outrightsUpserted: 0,
    goalscorersFetched: 0,
    goalscorersUpserted: 0,
  };
  if (!oddsApiEnabled) return summary;

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true, officialResults: true },
  });
  if (!tournament) return summary;

  // Restart-proof daily throttle: the outright rows carry the last run's
  // fetchedAt, so a cron redeploy/crash-loop (which resets the in-memory daily
  // bucket) can't re-spend the 4+ metered credits until the interval elapses.
  const lastRun = await prisma.teamOutright.findFirst({
    where: { tournamentId: tournament.id },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });
  if (!extrasPollDue(lastRun?.fetchedAt?.getTime() ?? null, Date.now())) {
    return { ...summary, skipped: true };
  }

  // --- Totals: update existing MatchOdds rows only. The h2h poll owns row
  // creation; updateMany simply no-ops (0 rows) until that row exists. ---
  try {
    const coded = await loadCodedMatches(tournament.id, tournament.officialResults);
    const events = await fetchTotalsEvents();
    summary.totalsFetched = events.length;
    for (const ev of events) {
      const home = normalizeTeam(ev.homeName);
      const away = normalizeTeam(ev.awayName);
      if (!home || !away) continue;
      const matchNo = resolveMatchNo(home, away, coded);
      if (matchNo == null) continue;
      const matchId = coded.find((m) => m.matchNo === matchNo)!.matchId;
      const probs = toTwoWayProbs(ev.decimalOver, ev.decimalUnder);
      const res = await prisma.matchOdds.updateMany({
        where: { matchId },
        data: { totalLine: ev.totalLine, overProb: probs.overProb, underProb: probs.underProb },
      });
      summary.totalsUpdated += res.count;
    }
  } catch (err) {
    console.error("odds extras: totals failed:", err);
  }

  // --- Spreads: Asian-handicap line per fixture. Like totals, update existing
  // MatchOdds rows only (the h2h poll owns row creation). Home-orient each line so
  // spreadLine/spreadHomeProb read from our fixture's designated home side. ---
  try {
    const coded = await loadCodedMatches(tournament.id, tournament.officialResults);
    const events = await fetchSpreadsEvents();
    summary.spreadsFetched = events.length;
    for (const ev of events) {
      const home = normalizeTeam(ev.homeName);
      const away = normalizeTeam(ev.awayName);
      if (!home || !away) continue;
      const matchNo = resolveMatchNo(home, away, coded);
      if (matchNo == null) continue;
      const codedMatch = coded.find((m) => m.matchNo === matchNo)!;
      const oriented = orientSpreadToHome(
        ev.homeLine,
        toSpreadProbs(ev.decimalHome, ev.decimalAway),
        home,
        codedMatch.homeCode,
      );
      const res = await prisma.matchOdds.updateMany({
        where: { matchId: codedMatch.matchId },
        data: {
          spreadLine: oriented.homeLine,
          spreadHomeProb: oriented.homeCoverProb,
          spreadAwayProb: oriented.awayCoverProb,
        },
      });
      summary.spreadsUpdated += res.count;
    }
  } catch (err) {
    console.error("odds extras: spreads failed:", err);
  }

  // --- Outrights: tournament-wide championship odds. Replace the whole set in one
  // transaction so teams the market has dropped (eliminated) don't linger with a
  // stale probability. Skip entirely on an empty parse so a bad fetch never wipes
  // the last-known odds. ---
  try {
    const entries = await fetchOutrights();
    summary.outrightsFetched = entries.length;
    const probs = toOutrightProbs(entries);
    if (probs.length > 0) {
      const now = new Date();
      await prisma.$transaction([
        prisma.teamOutright.deleteMany({ where: { tournamentId: tournament.id } }),
        prisma.teamOutright.createMany({
          data: probs.map((p) => ({
            tournamentId: tournament.id,
            teamCode: p.teamCode,
            winProb: p.winProb,
            decimal: p.decimal,
            source: "the-odds-api",
            fetchedAt: now,
          })),
        }),
      ]);
      summary.outrightsUpserted = probs.length;
    }
  } catch (err) {
    console.error("odds extras: outrights failed:", err);
  }

  // --- Top-goalscorer outrights: same replace-all-in-a-transaction pattern as the
  // champion outrights. Isolated so a missing market / wrong sport key (404) just
  // leaves the Golden Boot favorites empty rather than failing the whole poll. ---
  try {
    const entries = await fetchGoalscorerOutrights();
    summary.goalscorersFetched = entries.length;
    const probs = toGoalscorerProbs(entries);
    if (probs.length > 0) {
      const now = new Date();
      await prisma.$transaction([
        prisma.goalscorerOutright.deleteMany({ where: { tournamentId: tournament.id } }),
        prisma.goalscorerOutright.createMany({
          data: probs.map((p) => ({
            tournamentId: tournament.id,
            playerName: p.playerName,
            winProb: p.winProb,
            decimal: p.decimal,
            source: "the-odds-api",
            fetchedAt: now,
          })),
        }),
      ]);
      summary.goalscorersUpserted = probs.length;
    }
  } catch (err) {
    console.error("odds extras: goalscorers failed:", err);
  }

  return summary;
}
