// Pure parser for API-Football's /players response (paginated bio + season stats).
// No env/network, so it's unit-tested directly. For a league+season query each
// player's `statistics` is scoped to that competition, so we read statistics[0].
// Maps the provider team id to our code when possible; drops rows with no player id
// or name (never guessed).

import { EXTERNAL_TEAM_CODES } from "@/lib/sports/fixtures-map";

export interface PlayerProfileEntry {
  externalId: number;
  playerName: string;
  teamCode: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  nationality: string | null;
  height: string | null;
  position: string | null;
  photoUrl: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  rating: number | null;
  yellowCards: number | null;
  redCards: number | null;
  source: ApiPlayer;
}

export interface ApiPlayer {
  player?: {
    id?: number | null;
    name?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    age?: number | null;
    nationality?: string | null;
    height?: string | null;
    photo?: string | null;
  };
  statistics?: Array<{
    team?: { id?: number | null };
    games?: { appearences?: number | null; minutes?: number | null; position?: string | null; rating?: string | number | null };
    goals?: { total?: number | null; assists?: number | null };
    shots?: { total?: number | null };
    cards?: { yellow?: number | null; red?: number | null };
  }>;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

export function parseApiPlayer(row: ApiPlayer): PlayerProfileEntry | null {
  const id = row.player?.id;
  const name = row.player?.name?.trim();
  if (id == null || !name) return null;

  const s = row.statistics?.[0];
  const teamId = s?.team?.id;
  const teamCode = teamId != null ? (EXTERNAL_TEAM_CODES[String(teamId)] ?? null) : null;

  return {
    externalId: id,
    playerName: name,
    teamCode,
    firstName: row.player?.firstname?.trim() || null,
    lastName: row.player?.lastname?.trim() || null,
    age: row.player?.age ?? null,
    nationality: row.player?.nationality?.trim() || null,
    height: row.player?.height?.trim() || null,
    position: s?.games?.position?.trim() || null,
    photoUrl: row.player?.photo?.trim() || null,
    appearances: s?.games?.appearences ?? null,
    minutes: s?.games?.minutes ?? null,
    goals: s?.goals?.total ?? null,
    assists: s?.goals?.assists ?? null,
    shots: s?.shots?.total ?? null,
    rating: num(s?.games?.rating ?? null),
    yellowCards: s?.cards?.yellow ?? null,
    redCards: s?.cards?.red ?? null,
    source: row,
  };
}

export function parsePlayers(raw: ApiPlayer[]): PlayerProfileEntry[] {
  const out: PlayerProfileEntry[] = [];
  for (const row of raw ?? []) {
    const entry = parseApiPlayer(row);
    if (entry) out.push(entry);
  }
  return out;
}
