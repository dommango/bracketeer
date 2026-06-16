// Pure parser for API-Football's /players/topscorers response — no env/network, so
// it's unit-tested directly. Maps the provider team id to our 3-letter code and
// drops players whose team or goal count can't be resolved (never guessed).

import { EXTERNAL_TEAM_CODES } from "@/lib/sports/fixtures-map";

export interface TopScorerEntry {
  rank: number; // 1-based, after dropping unresolved rows
  playerName: string;
  teamCode: string;
  goals: number;
  assists: number | null;
  appearances: number | null;
  source: ApiTopScorer; // original provider row, persisted to `raw` for audit
}

export interface ApiTopScorer {
  player?: { name?: string | null };
  statistics?: Array<{
    team?: { id?: number | null };
    goals?: { total?: number | null; assists?: number | null };
    games?: { appearences?: number | null };
  }>;
}

export function parseTopScorers(raw: ApiTopScorer[]): TopScorerEntry[] {
  const out: TopScorerEntry[] = [];
  for (const p of raw ?? []) {
    const name = p.player?.name?.trim();
    const stat = p.statistics?.[0];
    const teamId = stat?.team?.id;
    const goals = stat?.goals?.total;
    const teamCode = teamId != null ? EXTERNAL_TEAM_CODES[String(teamId)] : undefined;
    // Require a name, a resolvable team, and a goal count — skip anything else.
    if (!name || !teamCode || goals == null) continue;
    out.push({
      rank: out.length + 1, // assigned after filtering so ranks are gap-free
      playerName: name,
      teamCode,
      goals,
      assists: stat?.goals?.assists ?? null,
      appearances: stat?.games?.appearences ?? null,
      source: p,
    });
  }
  return out;
}
