// Pure parser for API-Football's secondary leaderboards — /players/topassists,
// /players/topyellowcards, /players/topredcards. All three share the player-stats
// response shape (only the ranked stat differs), so one parser handles them by
// `category`. No env/network, so it's unit-tested directly. Maps the provider team
// id to our 3-letter code and drops rows whose team or ranked value can't be
// resolved (never guessed). The provider returns each board pre-sorted by its stat.

import { EXTERNAL_TEAM_CODES } from "@/lib/sports/fixtures-map";

export type StatCategory = "ASSISTS" | "YELLOW_CARDS" | "RED_CARDS";

export interface ApiStatLeader {
  player?: { name?: string | null };
  statistics?: Array<{
    team?: { id?: number | null };
    games?: { appearences?: number | null };
    goals?: { assists?: number | null };
    cards?: { yellow?: number | null; red?: number | null };
  }>;
}

export interface StatLeaderEntry {
  rank: number; // 1-based, gap-free after dropping unresolved rows
  playerName: string;
  teamCode: string;
  value: number; // the category's ranked stat
  appearances: number | null;
  source: ApiStatLeader; // original provider row, persisted to `raw` for audit
}

function valueFor(
  category: StatCategory,
  stat: NonNullable<ApiStatLeader["statistics"]>[number],
): number | null {
  switch (category) {
    case "ASSISTS":
      return stat.goals?.assists ?? null;
    case "YELLOW_CARDS":
      return stat.cards?.yellow ?? null;
    case "RED_CARDS":
      return stat.cards?.red ?? null;
  }
}

export function parseStatLeaders(raw: ApiStatLeader[], category: StatCategory): StatLeaderEntry[] {
  const out: StatLeaderEntry[] = [];
  for (const p of raw ?? []) {
    const name = p.player?.name?.trim();
    const stat = p.statistics?.[0];
    const teamId = stat?.team?.id;
    const teamCode = teamId != null ? EXTERNAL_TEAM_CODES[String(teamId)] : undefined;
    const value = stat ? valueFor(category, stat) : null;
    // Require a name, a resolvable team, and a positive value — a 0 on this board is
    // noise (the provider pads the tail), so skip it.
    if (!name || !teamCode || value == null || value <= 0) continue;
    out.push({
      rank: out.length + 1,
      playerName: name,
      teamCode,
      value,
      appearances: stat?.games?.appearences ?? null,
      source: p,
    });
  }
  return out;
}
