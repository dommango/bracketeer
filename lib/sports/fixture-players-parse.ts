// Pure parser + home/away assignment for API-Football's /fixtures/players response
// — no env/network, so it's unit-tested directly. The fetch wrapper in client.ts
// binds it to the network; the poller supplies the fixture's provider team ids so
// each squad is assigned to the right side regardless of response array order.

export interface PlayerStatLine {
  name: string | null;
  number: number | null;
  pos: string | null; // "G" | "D" | "M" | "F"
  rating: number | null; // API sends a string like "7.5"
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  shotsTotal: number | null;
  shotsOn: number | null;
  passes: number | null;
  passAccuracy: number | null;
  captain: boolean;
}

export interface ApiFixturePlayerEntry {
  team?: { id?: number | null };
  players?: Array<{
    player?: { name?: string | null };
    statistics?: Array<{
      games?: {
        minutes?: number | null;
        number?: number | null;
        position?: string | null;
        rating?: string | number | null;
        captain?: boolean | null;
      };
      goals?: { total?: number | null; assists?: number | null };
      shots?: { total?: number | null; on?: number | null };
      passes?: { total?: number | null; accuracy?: number | string | null };
    }>;
  }>;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function parseTeamPlayers(entry: ApiFixturePlayerEntry): PlayerStatLine[] {
  return (entry.players ?? []).map((p) => {
    const s = p.statistics?.[0];
    return {
      name: p.player?.name ?? null,
      number: s?.games?.number ?? null,
      pos: s?.games?.position ?? null,
      rating: num(s?.games?.rating ?? null),
      minutes: s?.games?.minutes ?? null,
      goals: s?.goals?.total ?? null,
      assists: s?.goals?.assists ?? null,
      shotsTotal: s?.shots?.total ?? null,
      shotsOn: s?.shots?.on ?? null,
      passes: s?.passes?.total ?? null,
      passAccuracy: num(s?.passes?.accuracy ?? null),
      captain: Boolean(s?.games?.captain),
    };
  });
}

// Assign the two parsed squads to home/away strictly by provider team id (never by
// array order — the provider doesn't guarantee it). Returns null when either side
// can't be matched, so the caller leaves it for a later run instead of guessing.
export function parseFixturePlayers(
  raw: ApiFixturePlayerEntry[],
  homeTeamId: number,
  awayTeamId: number,
): { home: PlayerStatLine[]; away: PlayerStatLine[] } | null {
  const sides = raw ?? [];
  if (sides.length < 2) return null;
  const homeSide = sides.find((s) => s.team?.id === homeTeamId);
  const awaySide = sides.find((s) => s.team?.id === awayTeamId);
  if (!homeSide || !awaySide) return null;
  return { home: parseTeamPlayers(homeSide), away: parseTeamPlayers(awaySide) };
}

export interface PlayerOfMatch {
  side: "home" | "away";
  player: PlayerStatLine;
}

// The standout performer: highest non-null match rating across both sides. Ties
// break to more minutes played, then to the home side (home squads are listed
// first, so the reduce keeps the earlier entry on a dead tie). Null when no rated
// players (e.g. ratings not yet published mid-match).
export function playerOfTheMatch(
  home: PlayerStatLine[],
  away: PlayerStatLine[],
): PlayerOfMatch | null {
  const pool: PlayerOfMatch[] = [
    ...home.filter((p) => p.rating != null).map((player) => ({ side: "home" as const, player })),
    ...away.filter((p) => p.rating != null).map((player) => ({ side: "away" as const, player })),
  ];
  if (pool.length === 0) return null;
  return pool.reduce((best, cur) => {
    const br = best.player.rating ?? 0;
    const cr = cur.player.rating ?? 0;
    if (cr !== br) return cr > br ? cur : best;
    const bm = best.player.minutes ?? 0;
    const cm = cur.player.minutes ?? 0;
    return cm > bm ? cur : best;
  });
}
