// Read model for the Match Day 3 Pickem UI: the 24 fixtures decorated with team
// names, the viewer's prediction, the live/final result (oriented to the fixture's
// canonical home/away by team code), per-match lock state, and points earned.

import { prisma } from "@/lib/db";
import { TEAMS } from "@/lib/scoring/data";
import {
  md3Fixtures,
  MD3_MATCH_NOS,
  isMd3MatchLocked,
  revealMd3Fixture,
  scoreMd3,
} from "@/lib/pool/match-day-3";
import { getStandaloneMd3Entry, decodeMd3Rows, type Md3Scores } from "@/lib/pool/md3-picks";
import type { ImpliedProbs } from "@/lib/odds/map";

export interface Md3FixtureVM {
  matchNo: number;
  group: string;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  kickoffISO: string;
  locked: boolean;
  // The entry's prediction, or null when not predicted OR hidden from this
  // viewer (see predHidden). Never carries another player's pick before kickoff.
  pred: { home: number; away: number } | null;
  // True when a prediction is being withheld because the fixture hasn't kicked
  // off and the viewer doesn't own this entry. Distinguishes "hidden until
  // kickoff" from a genuine no-pick so the UI can show the right placeholder
  // without leaking whether the owner predicted this fixture.
  predHidden: boolean;
  result: { home: number; away: number; final: boolean } | null;
  points: number | null;
  // Pre-match win/draw/win probabilities, oriented to the fixture's home/away
  // (the draw orientation the odds are stored in). Null when not priced.
  odds: ImpliedProbs | null;
}

export interface Md3View {
  fixtures: Md3FixtureVM[];
  totalPoints: number;
  scoredCount: number;
  pickedCount: number;
  openCount: number;
  // Fixtures that have kicked off without a prediction — a late joiner can no
  // longer pick these. Distinct from openCount (still pickable) so the UI can
  // tell "missed" from "still open".
  missedCount: number;
}

// The viewer's MD3 predictions in the public challenge (standalone entry, no pool).
export async function getMd3ChallengeView(
  tournamentId: string,
  userId: string | null,
  now: Date = new Date(),
): Promise<Md3View> {
  const entry = userId ? await getStandaloneMd3Entry(tournamentId, userId) : null;
  // The viewer's own predictions — always fully revealed to them.
  return buildMd3View(tournamentId, entry?.scores ?? null, now, true);
}

export interface Md3EntryView {
  entryId: string;
  label: string;
  view: Md3View;
}

// A single MD3 entry's decorated predictions, for the public per-entry breakdown
// page. Scoped to the tournament so an entryId from another tournament can't be
// surfaced here. Returns null when the entry doesn't exist (or isn't MD3).
//
// `viewerId` is the signed-in viewer (or null). Another player's predictions are
// withheld fixture-by-fixture until each fixture kicks off; the owner always sees
// their own. Points/results are unaffected — they only exist once a fixture is
// final (i.e. already kicked off), so the public board still shows everyone's total.
export async function getMd3EntryView(
  tournamentId: string,
  entryId: string,
  viewerId: string | null = null,
  now: Date = new Date(),
): Promise<Md3EntryView | null> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      label: true,
      userId: true,
      tournamentId: true,
      format: true,
      picks: { select: { category: true, key: true, teamOrValue: true } },
    },
  });
  if (!entry || entry.tournamentId !== tournamentId || entry.format !== "MATCH_DAY_3_PICKEM") {
    return null;
  }
  const isOwner = !!viewerId && entry.userId === viewerId;
  const view = await buildMd3View(tournamentId, decodeMd3Rows(entry.picks), now, isOwner);
  return { entryId: entry.id, label: entry.label, view };
}

// Build the read model from a set of predictions, decorating the 24 fixtures with
// live/final results and per-match lock state. Source-agnostic (pool or challenge).
// `isOwner` controls pick visibility: when false, a fixture's prediction is hidden
// until that fixture kicks off (see revealMd3Fixture).
async function buildMd3View(
  tournamentId: string,
  preds: Md3Scores | null,
  now: Date,
  isOwner: boolean,
): Promise<Md3View> {
  const fixtures = md3Fixtures();

  const resultRows = await prisma.result.findMany({
    where: { match: { tournamentId, matchNo: { in: [...MD3_MATCH_NOS] } } },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      status: true,
      match: { select: { matchNo: true } },
    },
  });

  // Map matchNo → { teamCode: goals, final }.
  const byNo = new Map<number, { byTeam: Record<string, number>; final: boolean }>();
  for (const r of resultRows) {
    if (!r.homeTeamCode || !r.awayTeamCode || r.homeScore === null || r.awayScore === null) continue;
    byNo.set(r.match.matchNo, {
      byTeam: { [r.homeTeamCode]: r.homeScore, [r.awayTeamCode]: r.awayScore },
      final: r.status === "FINAL",
    });
  }

  // Pre-match odds per MD3 match, oriented to the match's home slot (== the
  // fixture's canonical home), keyed by matchNo for the win-probability bar.
  const oddsRows = await prisma.matchOdds.findMany({
    where: { match: { tournamentId, matchNo: { in: [...MD3_MATCH_NOS] } } },
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

  const predictions = preds ?? {};

  let totalPoints = 0;
  let scoredCount = 0;
  let pickedCount = 0;
  let openCount = 0;
  let missedCount = 0;

  const vms: Md3FixtureVM[] = fixtures.map((f) => {
    const locked = isMd3MatchLocked(f.matchNo, now);
    if (!locked) openCount += 1;

    const rawPred = predictions[f.matchNo] ?? null;
    if (rawPred) pickedCount += 1;
    else if (locked) missedCount += 1;

    // Hide another player's scoreline until this fixture kicks off. Withhold it
    // uniformly for every not-yet-revealed fixture (regardless of whether they
    // actually predicted it) so we never leak even *that* they made a pick.
    const reveal = revealMd3Fixture(f.matchNo, isOwner, now);
    const pred = reveal ? rawPred : null;
    const predHidden = !reveal;

    const r = byNo.get(f.matchNo);
    let result: Md3FixtureVM["result"] = null;
    if (r) {
      result = {
        home: r.byTeam[f.homeCode] ?? 0,
        away: r.byTeam[f.awayCode] ?? 0,
        final: r.final,
      };
      if (r.final) scoredCount += 1;
    }

    // Points are derived from a final result (so the fixture has kicked off and
    // is revealed anyway); use the true prediction so totals stay correct.
    let points: number | null = null;
    if (result?.final && rawPred) {
      points = scoreMd3(rawPred, { home: result.home, away: result.away });
      totalPoints += points;
    }

    return {
      matchNo: f.matchNo,
      group: f.group,
      homeCode: f.homeCode,
      awayCode: f.awayCode,
      homeName: TEAMS[f.homeCode] ?? f.homeCode,
      awayName: TEAMS[f.awayCode] ?? f.awayCode,
      kickoffISO: f.kickoff.toISOString(),
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
