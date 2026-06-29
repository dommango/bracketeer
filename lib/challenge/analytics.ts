// Analytics read-models for the public Knockout Challenge — the poolId-free twins
// of the pool analytics selectors (getPoolAnalytics / getPoolStandouts /
// getPoolProjection / getUpsetRadar in lib/pool/queries), keyed off the entered-
// challenge knockout entries instead of a pool. Reuse the same pure builders so the
// cards render identically to a pool's; only the entry set + odds source differ
// (tournament-scoped, shared across all pools and the challenge).

import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  getKnockoutState,
  getUpsetMatchesForTournament,
  type PoolProjection,
  type PoolProjectionRow,
} from "@/lib/pool/queries";
import { getChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { asResults, asScoringConfig } from "@/lib/pool/scoring";
import { resolveBracket } from "@/lib/pool/bracket";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { isKnockoutEntryComplete } from "@/lib/challenge/eligibility";
import { publicLabel } from "@/lib/challenge/public-label";
import { buildPickAnalytics, type PickAnalytics } from "@/lib/pool/pick-analytics";
import { buildPoolStandouts, type StandoutInput, type PoolStandouts } from "@/lib/pool/standouts";
import { buildWinModel, type R32MatchInput } from "@/lib/pool/win-model";
import { projectStandings, type ProjectionEntry } from "@/lib/pool/expected-points";
import { buildUpsetRadar, stakedTeamCodes, type UpsetRow } from "@/lib/odds/upset";
import type { Picks } from "@/lib/scoring/types";

const PICK_SELECT = {
  select: { section: true, category: true, key: true, code: true, teamOrValue: true },
} as const;

export interface ChallengeEntryPicks {
  entryId: string;
  label: string; // public display name (challenge name → account name → anon handle)
  picks: Picks;
}

// The eligible entered knockout brackets (verified-email owner + complete bracket),
// mirroring the public leaderboard's gate so analytics never reveal an incomplete or
// unverified entry. Labels resolve the same public display name the board uses, not
// the raw Entry.label. Per-request memoized.
export const getChallengeEntriesWithPicks = cache(
  async (tournamentId: string): Promise<ChallengeEntryPicks[]> => {
    const entries = await prisma.entry.findMany({
      where: { tournamentId, format: "KNOCKOUT", enteredChallenge: true },
      select: {
        id: true,
        userId: true,
        user: { select: { emailVerified: true, name: true, challengeDisplayName: true } },
        picks: PICK_SELECT,
      },
    });
    const out: ChallengeEntryPicks[] = [];
    for (const e of entries) {
      if (!e.userId || !e.user?.emailVerified) continue;
      try {
        const picks = pickRowsToSubmission(e.picks).picks;
        if (!isKnockoutEntryComplete(picks)) continue;
        out.push({
          entryId: e.id,
          label: publicLabel(e.user.challengeDisplayName ?? e.user.name, e.userId),
          picks,
        });
      } catch {
        // Skip a malformed bracket rather than fail the whole card.
      }
    }
    return out;
  },
);

const EMPTY_PROJECTION: PoolProjection = { hasData: false, rows: [], fetchedAt: null };

// Probabilistic challenge-field projection: each entered bracket's expected remaining
// knockout points + projected rank, from the same champion-outright + R32 match-odds
// win model the pool uses (buildWinModel → projectStandings). Display-only; hasData
// false when the odds integration has populated neither market. Per-request memoized.
export const getChallengeKnockoutProjection = cache(
  async (tournamentId: string): Promise<PoolProjection> => {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { officialResults: true, scoringConfig: true },
    });
    if (!tournament) return EMPTY_PROJECTION;

    const results = asResults(tournament.officialResults);
    const cfg = asScoringConfig(tournament.scoringConfig);
    const resolved = resolveBracket(results);
    const decided = (results.knockout ?? {}) as Record<number, string>;

    const [r32Matches, outrightRows] = await Promise.all([
      prisma.match.findMany({
        where: { tournamentId, matchNo: { gte: 73, lte: 88 } },
        select: {
          matchNo: true,
          odds: { select: { homeWinProb: true, drawProb: true, awayWinProb: true, fetchedAt: true } },
          result: { select: { homeTeamCode: true, awayTeamCode: true } },
        },
      }),
      prisma.teamOutright.findMany({
        where: { tournamentId },
        select: { teamCode: true, winProb: true, fetchedAt: true },
      }),
    ]);

    const r32: R32MatchInput[] = r32Matches.map((m) => {
      const r = resolved[m.matchNo];
      return {
        matchId: m.matchNo,
        homeCode: m.result?.homeTeamCode ?? r?.home ?? null,
        awayCode: m.result?.awayTeamCode ?? r?.away ?? null,
        homeWinProb: m.odds?.homeWinProb ?? null,
        drawProb: m.odds?.drawProb ?? null,
        awayWinProb: m.odds?.awayWinProb ?? null,
      };
    });

    const outrights: Record<string, number> = {};
    for (const o of outrightRows) outrights[o.teamCode] = o.winProb;

    const model = buildWinModel({ r32, outrights, decided });
    if (!model.hasData) return EMPTY_PROJECTION;

    const [board, entries] = await Promise.all([
      getChallengeLeaderboard(),
      getChallengeEntriesWithPicks(tournamentId),
    ]);
    const totalByEntry = new Map(board.map((r) => [r.entryId, r.total]));
    const currentRankByEntry = new Map(board.map((r) => [r.entryId, r.rank]));
    const userByEntry = new Map(board.map((r) => [r.entryId, r.userId]));
    const labelByEntry = new Map(board.map((r) => [r.entryId, r.label]));

    const projectionEntries: ProjectionEntry[] = entries.map((e) => ({
      entryId: e.entryId,
      actualPoints: totalByEntry.get(e.entryId) ?? 0,
      knockout: e.picks.knockout ?? {},
    }));

    const rows: PoolProjectionRow[] = projectStandings(projectionEntries, model, decided, cfg).map(
      (p) => ({
        entryId: p.entryId,
        label: labelByEntry.get(p.entryId) ?? "—",
        userId: userByEntry.get(p.entryId) ?? null,
        actualPoints: p.actualPoints,
        expectedRemaining: p.expectedRemaining,
        projectedTotal: p.projectedTotal,
        projectedRank: p.projectedRank,
        currentRank: currentRankByEntry.get(p.entryId) ?? p.projectedRank,
      }),
    );

    const stamps: number[] = [];
    for (const m of r32Matches) if (m.odds?.fetchedAt) stamps.push(m.odds.fetchedAt.getTime());
    for (const o of outrightRows) stamps.push(o.fetchedAt.getTime());
    const fetchedAt = stamps.length ? new Date(Math.max(...stamps)) : null;

    return { hasData: true, rows, fetchedAt };
  },
);

// Field-wide pick consensus across the entered knockout brackets. Gated behind the
// R32 lock so brackets aren't revealed pre-lock (the same principle as the pool's
// arePicksLocked gate); null when locked-open or with no eligible entries.
export async function getChallengeAnalytics(tournamentId: string): Promise<PickAnalytics | null> {
  const { locksAt } = await getKnockoutState(tournamentId);
  if (!isKnockoutLocked(locksAt)) return null;
  const entries = await getChallengeEntriesWithPicks(tournamentId);
  if (entries.length === 0) return null;
  return buildPickAnalytics(entries.map((e) => e.picks));
}

// Field-level standouts (upside / contrarian / diversity), extending the consensus
// card. Same R32-lock gate as the analytics. Upside is empty (the pick-only lenses
// still render) when the odds integration has no data.
export async function getChallengeStandouts(tournamentId: string): Promise<PoolStandouts | null> {
  const { locksAt } = await getKnockoutState(tournamentId);
  if (!isKnockoutLocked(locksAt)) return null;
  const [entries, projection] = await Promise.all([
    getChallengeEntriesWithPicks(tournamentId),
    getChallengeKnockoutProjection(tournamentId),
  ]);
  if (entries.length === 0) return null;

  const evByEntry = new Map(projection.rows.map((r) => [r.entryId, r.expectedRemaining]));
  const inputs: StandoutInput[] = entries.map((e) => ({
    entryId: e.entryId,
    label: e.label,
    picks: e.picks,
    expectedRemaining: projection.hasData ? (evByEntry.get(e.entryId) ?? 0) : null,
  }));
  return buildPoolStandouts(inputs);
}

// The personalised upset radar for the challenge: upcoming priced matches most
// likely to defy the favorite, tagged with the teams the viewer backed across their
// entered knockout brackets. Anonymous viewers get an untagged radar.
export async function getChallengeUpsetRadar(
  tournamentId: string,
  userId: string | null,
): Promise<UpsetRow[]> {
  const upsetMatches = await getUpsetMatchesForTournament(tournamentId);
  const staked = new Set<string>();
  if (userId) {
    const mine = await prisma.entry.findMany({
      where: { userId, tournamentId, format: "KNOCKOUT", enteredChallenge: true },
      select: { picks: PICK_SELECT },
    });
    for (const e of mine) {
      try {
        for (const code of stakedTeamCodes(pickRowsToSubmission(e.picks).picks)) staked.add(code);
      } catch {
        // Skip a malformed bracket.
      }
    }
  }
  return buildUpsetRadar(upsetMatches, staked);
}
