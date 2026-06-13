// Score poller: pulls finished fixtures and applies knockout winners to the
// answer key, never overwriting a manual entry. Group results are not applied
// here — group scoring is driven by standings (1st/2nd/thirds), which an admin
// sets directly. Safe no-op when SPORTS_API_KEY or the fixture maps are empty.

import { sportsApiEnabled } from "@/lib/env";
import { isScoredKnockout } from "@/lib/pool/rounds";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { fetchFixtures, type FinishedFixture } from "./client";
import { EXTERNAL_TO_MATCHNO, EXTERNAL_TEAM_CODES } from "./fixtures-map";
import {
  setKnockoutResultFromApi,
  upsertGroupMatchResultFromApi,
  backfillGroupMatchScheduledAt,
  recomputeTournamentPools,
} from "@/lib/pool/results";
import { resolveWinnerExternalId } from "./winner";
import { buildGroupPairMatchNos } from "@/lib/scoring/data";

export interface PollSummary {
  skipped?: boolean;
  reason?: string;
  fetched?: number;
  applied?: number;
  groupsApplied?: number;
}

function resolveWinnerCode(f: FinishedFixture): string | null {
  const winnerExternalId = resolveWinnerExternalId(f);
  if (winnerExternalId == null) return null;
  return EXTERNAL_TEAM_CODES[winnerExternalId] ?? null;
}

export async function pollScores(): Promise<PollSummary> {
  if (!sportsApiEnabled) return { skipped: true, reason: "SPORTS_API_KEY not configured" };

  const tournamentId = await getTournamentIdBySlug();
  const fixtures = await fetchFixtures();

  // --- Pass 1: knockout results via fixture-id map ---
  let applied = 0;
  for (const f of fixtures) {
    const matchNo = EXTERNAL_TO_MATCHNO[f.externalId];
    if (!matchNo || !isScoredKnockout(matchNo)) continue;
    if (!f.finished) continue;

    const winnerCode = resolveWinnerCode(f);
    if (!winnerCode) continue;

    const { applied: didApply } = await setKnockoutResultFromApi(tournamentId, matchNo, {
      winnerCode,
      homeScore: f.homeGoals,
      awayScore: f.awayGoals,
      final: true,
    });
    if (didApply) applied += 1;
  }

  // --- Pass 2: group match display scores + scheduledAt backfill ---
  // Requires EXTERNAL_TEAM_CODES to be populated; safe no-op otherwise.
  const groupPairMatchNos = buildGroupPairMatchNos();
  const scheduledAtQueue: Array<{ matchNo: number; scheduledAt: Date }> = [];
  let groupsApplied = 0;

  for (const f of fixtures) {
    const homeCode = EXTERNAL_TEAM_CODES[f.homeExternalId];
    const awayCode = EXTERNAL_TEAM_CODES[f.awayExternalId];
    if (!homeCode || !awayCode) continue;

    const pairKey = [homeCode, awayCode].sort().join("_");
    const matchNo = groupPairMatchNos.get(pairKey);
    if (!matchNo) continue; // not a known group matchup

    if (f.scheduledAt) scheduledAtQueue.push({ matchNo, scheduledAt: new Date(f.scheduledAt) });

    if (f.live || f.finished) {
      const { applied: didApply } = await upsertGroupMatchResultFromApi(tournamentId, matchNo, {
        homeCode,
        awayCode,
        homeScore: f.homeGoals,
        awayScore: f.awayGoals,
        live: f.live,
        finished: f.finished,
      });
      if (didApply) groupsApplied += 1;
    }
  }

  if (scheduledAtQueue.length > 0) {
    await backfillGroupMatchScheduledAt(tournamentId, scheduledAtQueue);
  }

  if (applied > 0 || groupsApplied > 0) await recomputeTournamentPools(tournamentId);
  return { fetched: fixtures.length, applied, groupsApplied };
}
