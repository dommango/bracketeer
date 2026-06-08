// Score poller: pulls finished fixtures and applies knockout winners to the
// answer key, never overwriting a manual entry. Group results are not applied
// here — group scoring is driven by standings (1st/2nd/thirds), which an admin
// sets directly. Safe no-op when SPORTS_API_KEY or the fixture maps are empty.

import { sportsApiEnabled } from "@/lib/env";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { fetchFixtures, type FinishedFixture } from "./client";
import { EXTERNAL_TO_MATCHNO, EXTERNAL_TEAM_CODES } from "./fixtures-map";
import { setKnockoutResultFromApi, recomputeTournamentPools } from "@/lib/pool/results";

export interface PollSummary {
  skipped?: boolean;
  reason?: string;
  fetched?: number;
  applied?: number;
}

function resolveWinnerCode(f: FinishedFixture): string | null {
  if (f.homeGoals == null || f.awayGoals == null || f.homeGoals === f.awayGoals) return null;
  const winnerExternalId = f.homeGoals > f.awayGoals ? f.homeExternalId : f.awayExternalId;
  return EXTERNAL_TEAM_CODES[winnerExternalId] ?? null;
}

export async function pollScores(): Promise<PollSummary> {
  if (!sportsApiEnabled) return { skipped: true, reason: "SPORTS_API_KEY not configured" };

  const tournamentId = await getTournamentIdBySlug();
  const fixtures = await fetchFixtures();

  let applied = 0;
  for (const f of fixtures) {
    const matchNo = EXTERNAL_TO_MATCHNO[f.externalId];
    if (!matchNo || matchNo < 73 || matchNo > 104) continue; // knockouts only
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

  if (applied > 0) await recomputeTournamentPools(tournamentId);
  return { fetched: fixtures.length, applied };
}
