// Pure parser for API-Football's /teams/statistics response (a single object per
// team, not an array) — no env/network, so it's unit-tested directly. Pulls the
// tournament totals we surface on the team page; returns null when the core totals
// are absent (a not-yet-populated response) so the poller leaves the last-known row.

export interface TeamStatSummary {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  failedToScore: number;
  form: string | null; // recent results, most recent last (e.g. "WWDLW")
}

export interface ApiTeamStatistics {
  form?: string | null;
  fixtures?: {
    played?: { total?: number | null };
    wins?: { total?: number | null };
    draws?: { total?: number | null };
    loses?: { total?: number | null };
  };
  goals?: {
    for?: { total?: { total?: number | null } };
    against?: { total?: { total?: number | null } };
  };
  clean_sheet?: { total?: number | null };
  failed_to_score?: { total?: number | null };
}

const n = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function parseTeamStatistics(raw: ApiTeamStatistics | null | undefined): TeamStatSummary | null {
  if (!raw || !raw.fixtures) return null;
  const played = raw.fixtures.played?.total;
  // A response with no games played yet carries nothing worth showing.
  if (played == null) return null;
  return {
    played: n(played),
    wins: n(raw.fixtures.wins?.total),
    draws: n(raw.fixtures.draws?.total),
    losses: n(raw.fixtures.loses?.total),
    goalsFor: n(raw.goals?.for?.total?.total),
    goalsAgainst: n(raw.goals?.against?.total?.total),
    cleanSheets: n(raw.clean_sheet?.total),
    failedToScore: n(raw.failed_to_score?.total),
    form: raw.form?.trim() || null,
  };
}
