// The public Bracketeer Knockout Challenge leaderboard: every knockout bracket
// whose owner has opted in (Entry.enteredChallenge), ranked together — across
// pooled and standalone brackets alike. Reads ONLY opted-in entries — brackets
// that haven't entered are never materialized here, so their picks/scores can't
// leak onto the public board — then overlays the same display-only live knockout
// projection the pool leaderboard uses and re-ranks 1..N.

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { asScoringConfig, type LeaderboardRow } from "@/lib/pool/scoring";
import { rankEnteredRows } from "@/lib/challenge/rank-entered";
import { liveLeaders, projectedLivePoints } from "@/lib/pool/projected";

// Knockout pick rows carry the match id in their CSV-mirrored category ("M73").
const KNOCKOUT_PICK_SECTIONS = [
  "round_of_32",
  "round_of_16",
  "quarterfinals",
  "semifinals",
  "final",
];

export async function getChallengeLeaderboard(
  tournamentSlug: string = DEFAULT_TOURNAMENT_SLUG,
): Promise<LeaderboardRow[]> {
  const tournamentId = await getTournamentIdBySlug(tournamentSlug);

  const entries = await prisma.entry.findMany({
    where: { tournamentId, format: "KNOCKOUT", enteredChallenge: true },
    select: {
      id: true,
      label: true,
      userId: true,
      tiebreak: true,
      breakdown: { select: { totalPoints: true, byCategory: true } },
    },
  });
  if (entries.length === 0) return [];

  const rows: LeaderboardRow[] = entries.map((e) => ({
    rank: 0,
    entryId: e.id,
    label: e.label,
    userId: e.userId,
    total: e.breakdown?.totalPoints ?? 0,
    breakdown: e.breakdown?.byCategory ?? null,
    tiebreak: e.tiebreak,
  }));

  const withLive = await overlayLiveProjection(
    tournamentId,
    rows,
    entries.map((e) => e.id),
  );

  // rankEnteredRows filters by id-set then ranks; passing every row's id makes
  // the filter a no-op and reuses its (unit-tested) live-total competition rank.
  return rankEnteredRows(withLive, new Set(rows.map((r) => r.entryId)));
}

// Add display-only projected live points to the entered rows from any live
// knockout match, scoped to these entries' picks only. Mirrors the pool's
// withProjectedPoints knockout branch; group provisional points don't apply
// (the Challenge is knockout-only, so entries hold no group picks).
async function overlayLiveProjection(
  tournamentId: string,
  rows: LeaderboardRow[],
  enteredIds: string[],
): Promise<LeaderboardRow[]> {
  const liveRows = await prisma.result.findMany({
    where: { status: "LIVE", match: { tournamentId } },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      homeScore: true,
      awayScore: true,
      status: true,
      match: { select: { matchNo: true } },
    },
  });
  const leaders = liveLeaders(liveRows.map((r) => ({ ...r, matchNo: r.match.matchNo })));
  if (leaders.length === 0) return rows;

  const pickRows = await prisma.pick.findMany({
    where: { entryId: { in: enteredIds }, section: { in: KNOCKOUT_PICK_SECTIONS } },
    select: { entryId: true, category: true, code: true },
  });
  const picksByEntry = new Map<string, Record<number, string>>();
  for (const p of pickRows) {
    if (!p.code) continue;
    const matchNo = Number(p.category.replace(/^M/i, ""));
    if (!Number.isInteger(matchNo)) continue;
    const entry = picksByEntry.get(p.entryId) ?? {};
    entry[matchNo] = p.code;
    picksByEntry.set(p.entryId, entry);
  }

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { scoringConfig: true },
  });
  const projected = projectedLivePoints(leaders, picksByEntry, asScoringConfig(tournament.scoringConfig));

  return rows.map((r) => {
    const pts = projected.get(r.entryId) ?? 0;
    return pts > 0 ? { ...r, projected: pts } : r;
  });
}
