// Read model for the knockout leg of the Match Day Pick'em UI: the 31 scored
// knockout fixtures decorated with team names, the viewer's prediction, the
// live/final result (oriented to the fixture's canonical home/away by team code),
// per-match lock state, and points earned. The knockout analog of md3-view.ts —
// but competitors are resolved from the tournament answer key (officialResults) via
// knockoutDailyFixtures, not from a fixed group draw, so a fixture whose two teams
// aren't decided yet surfaces as "awaiting" and can't be picked.

import { prisma } from "@/lib/db";
import { TEAMS } from "@/lib/scoring/data";
import { asResults } from "@/lib/pool/scoring";
import { knockoutDailyFixtures } from "@/lib/games/daily-pickem/fixtures";
import { DAILY_KNOCKOUT_MATCH_NOS, DAILY_KNOCKOUT_SECTION } from "@/lib/games/daily-pickem/scope";
import { isDailyKnockoutLocked, decodeDailyKnockoutScores } from "@/lib/games/daily-pickem/picks";
import { scoreDailyKnockout } from "@/lib/games/daily-pickem/score-knockout";
import { dailyKnockoutMatchDay } from "@/lib/games/daily-pickem/schedule";
import { stageOf, type Stage } from "@/lib/games/stage";
import type { ImpliedProbs } from "@/lib/odds/map";
import type { Results } from "@/lib/scoring/types";

export interface DailyKnockoutFixtureVM {
  matchNo: number;
  stage: Stage;
  // The knockout match-day bucket (kickoff calendar date, ET), for by-day grouping.
  matchDay: string;
  homeCode: string | null;
  awayCode: string | null;
  homeName: string;
  awayName: string;
  kickoffISO: string | null;
  // True once BOTH competitors are seated — i.e. the match can be picked.
  open: boolean;
  locked: boolean;
  // The entry's prediction, or null when not predicted OR hidden from this viewer
  // (see predHidden). Never carries another player's pick before kickoff.
  pred: { home: number; away: number } | null;
  predHidden: boolean;
  result: { home: number; away: number; final: boolean } | null;
  points: number | null;
  // Pre-match win/draw/win probabilities, oriented to the fixture's home/away.
  odds: ImpliedProbs | null;
}

export interface DailyKnockoutView {
  fixtures: DailyKnockoutFixtureVM[];
  totalPoints: number;
  scoredCount: number;
  pickedCount: number;
  openCount: number;
  // Fixtures that have kicked off (or otherwise locked) without a prediction — a
  // late joiner can no longer pick these. Distinct from openCount (still pickable).
  missedCount: number;
}

function teamName(code: string | null): string {
  if (!code) return "TBD";
  return TEAMS[code] ?? code;
}

// The viewer's knockout predictions in the public challenge (standalone entry).
export async function getDailyKnockoutView(
  tournamentId: string,
  userId: string | null,
  now: Date = new Date(),
): Promise<DailyKnockoutView> {
  const results = await loadResults(tournamentId);
  const preds = userId ? await loadEntryPreds(tournamentId, userId, results) : {};
  return buildDailyKnockoutView(tournamentId, results, preds, now, true);
}

export interface DailyKnockoutEntryView {
  entryId: string;
  label: string;
  view: DailyKnockoutView;
}

// A single entry's decorated knockout predictions, for the public per-entry
// breakdown page. Scoped to the tournament + MATCH_DAY_3_PICKEM format. `viewerId`
// is the signed-in viewer (or null); another player's predictions are withheld
// fixture-by-fixture until each fixture kicks off.
export async function getDailyKnockoutEntryView(
  tournamentId: string,
  entryId: string,
  viewerId: string | null = null,
  now: Date = new Date(),
): Promise<DailyKnockoutEntryView | null> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      label: true,
      userId: true,
      tournamentId: true,
      format: true,
      picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
    },
  });
  if (!entry || entry.tournamentId !== tournamentId || entry.format !== "MATCH_DAY_3_PICKEM") {
    return null;
  }
  const results = await loadResults(tournamentId);
  const fixtures = knockoutDailyFixtures(results);
  const preds = decodeDailyKnockoutScores(entry.picks, fixtures);
  const isOwner = !!viewerId && entry.userId === viewerId;
  const view = await buildDailyKnockoutView(tournamentId, results, preds, now, isOwner);
  return { entryId: entry.id, label: entry.label, view };
}

async function loadResults(tournamentId: string): Promise<Results> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  return asResults(tournament.officialResults);
}

async function loadEntryPreds(
  tournamentId: string,
  userId: string,
  results: Results,
): Promise<Record<number, { home: number; away: number }>> {
  const entry = await prisma.entry.findFirst({
    where: { tournamentId, userId, poolId: null, format: "MATCH_DAY_3_PICKEM" },
    select: {
      picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
    },
  });
  if (!entry) return {};
  return decodeDailyKnockoutScores(entry.picks, knockoutDailyFixtures(results));
}

// Build the read model from a set of predictions, decorating the knockout fixtures
// with live/final results and per-match lock state. `isOwner` controls pick
// visibility: when false, a fixture's prediction is hidden until it kicks off.
async function buildDailyKnockoutView(
  tournamentId: string,
  results: Results,
  preds: Record<number, { home: number; away: number }>,
  now: Date,
  isOwner: boolean,
): Promise<DailyKnockoutView> {
  const fixtures = knockoutDailyFixtures(results);

  const resultRows = await prisma.result.findMany({
    where: { match: { tournamentId, matchNo: { in: [...DAILY_KNOCKOUT_MATCH_NOS] } } },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      status: true,
      match: { select: { matchNo: true } },
    },
  });
  const byNo = new Map<number, { byTeam: Record<string, number>; final: boolean }>();
  for (const r of resultRows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore === null || r.awayScore === null) continue;
    byNo.set(r.match.matchNo, {
      byTeam: { [r.homeTeamCode]: r.homeScore, [r.awayTeamCode]: r.awayScore },
      final: r.status === "FINAL",
    });
  }

  const oddsRows = await prisma.matchOdds.findMany({
    where: { match: { tournamentId, matchNo: { in: [...DAILY_KNOCKOUT_MATCH_NOS] } } },
    select: {
      homeWinProb: true,
      drawProb: true,
      awayWinProb: true,
      match: { select: { matchNo: true } },
    },
  });
  const oddsByNo = new Map<number, ImpliedProbs>();
  for (const o of oddsRows) {
    oddsByNo.set(o.match.matchNo, {
      homeWinProb: o.homeWinProb,
      drawProb: o.drawProb,
      awayWinProb: o.awayWinProb,
    });
  }

  let totalPoints = 0;
  let scoredCount = 0;
  let pickedCount = 0;
  let openCount = 0;
  let missedCount = 0;

  const vms: DailyKnockoutFixtureVM[] = fixtures.map((f) => {
    const locked = isDailyKnockoutLocked(f.matchNo, now);
    // Only a seated, unlocked fixture is pickable right now.
    if (f.open && !locked) openCount += 1;

    const rawPred = preds[f.matchNo] ?? null;
    if (rawPred) pickedCount += 1;
    else if (f.open && locked) missedCount += 1;

    // Hide another player's scoreline until this fixture kicks off (locks).
    const reveal = isOwner || locked;
    const pred = reveal ? rawPred : null;
    const predHidden = !reveal && !!f.open;

    const r = byNo.get(f.matchNo);
    let result: DailyKnockoutFixtureVM["result"] = null;
    if (r && f.homeCode && f.awayCode) {
      result = {
        home: r.byTeam[f.homeCode] ?? 0,
        away: r.byTeam[f.awayCode] ?? 0,
        final: r.final,
      };
      if (r.final) scoredCount += 1;
    }

    let points: number | null = null;
    if (result?.final && rawPred && f.homeCode && f.awayCode) {
      const byTeam = { [f.homeCode]: rawPred.home, [f.awayCode]: rawPred.away };
      points = scoreDailyKnockout({
        predByTeam: byTeam,
        homeCode: f.homeCode,
        awayCode: f.awayCode,
        actual: { home: result.home, away: result.away },
        winnerCode: results.knockout?.[f.matchNo] ?? null,
      }).points;
      totalPoints += points;
    }

    return {
      matchNo: f.matchNo,
      stage: (stageOf(f.matchNo) ?? "R32") as Stage,
      matchDay: dailyKnockoutMatchDay(f.matchNo),
      homeCode: f.homeCode,
      awayCode: f.awayCode,
      homeName: teamName(f.homeCode),
      awayName: teamName(f.awayCode),
      kickoffISO: f.kickoff ? f.kickoff.toISOString() : null,
      open: f.open,
      locked,
      pred,
      predHidden,
      result,
      points,
      odds: oddsByNo.get(f.matchNo) ?? null,
    };
  });

  return { fixtures: vms, totalPoints, scoredCount, pickedCount, openCount, missedCount };
}

// A hint for whether the current daily_knockout section holds any rows for a user —
// used by the participant gate without decoding the full view.
export async function hasDailyKnockoutPicks(tournamentId: string, userId: string): Promise<boolean> {
  const row = await prisma.pick.findFirst({
    where: {
      section: DAILY_KNOCKOUT_SECTION,
      entry: { tournamentId, userId, poolId: null, format: "MATCH_DAY_3_PICKEM" },
    },
    select: { id: true },
  });
  return !!row;
}
