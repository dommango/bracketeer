// Pure parser + home/away assignment for API-Football's /fixtures/lineups response
// — no env/network, so it's unit-tested directly. The fetch wrapper in client.ts
// binds it to the network; the poller supplies the fixture's resolved team codes.

import { EXTERNAL_TEAM_CODES } from "@/lib/sports/fixtures-map";

export interface LineupPlayer {
  name: string | null;
  number: number | null;
  pos: string | null; // "G" | "D" | "M" | "F"
}

export interface LineupTeam {
  teamId: number | null;
  formation: string | null;
  players: LineupPlayer[]; // starting XI
}

export interface ApiLineupEntry {
  team?: { id?: number | null };
  formation?: string | null;
  startXI?: Array<{
    player?: { name?: string | null; number?: number | null; pos?: string | null };
  }>;
}

export function parseLineups(raw: ApiLineupEntry[]): LineupTeam[] {
  return (raw ?? []).map((entry) => ({
    teamId: entry.team?.id ?? null,
    formation: entry.formation?.trim() || null,
    players: (entry.startXI ?? []).map((s) => ({
      name: s.player?.name ?? null,
      number: s.player?.number ?? null,
      pos: s.player?.pos ?? null,
    })),
  }));
}

// internal 3-letter code -> provider team id (reverse of EXTERNAL_TEAM_CODES).
const CODE_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(EXTERNAL_TEAM_CODES).map(([id, code]) => [code, Number(id)]),
);

// Assign the two parsed lineups to home/away strictly by provider team id — never
// by array order (the provider doesn't guarantee it, and a silent swap would show
// the wrong XI for each team). Returns null when either side can't be resolved
// (unknown code, knockout slot not yet filled, or both sides collapsing to one),
// so the caller leaves it for a later run instead of guessing.
export function assignSides(
  teams: LineupTeam[],
  homeCode: string | null,
  awayCode: string | null,
): { home: LineupTeam; away: LineupTeam } | null {
  const homeId = homeCode ? CODE_TO_ID[homeCode] : undefined;
  const awayId = awayCode ? CODE_TO_ID[awayCode] : undefined;
  if (homeId == null || awayId == null) return null;
  const home = teams.find((t) => t.teamId === homeId);
  const away = teams.find((t) => t.teamId === awayId);
  if (!home || !away || home.teamId === away.teamId) return null;
  return { home, away };
}
