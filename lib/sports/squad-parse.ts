// Pure parser for API-Football's /players/squads response — no env/network, so it's
// unit-tested directly. The response is an array with one team entry; we return its
// roster sorted by position (GK → DEF → MID → FWD) then shirt number. Returns an
// empty array when the squad hasn't been named yet, so the poller skips the write.

export interface SquadPlayer {
  name: string;
  number: number | null;
  position: string | null; // "Goalkeeper" | "Defender" | "Midfielder" | "Attacker"
  age: number | null;
}

export interface ApiSquad {
  players?: Array<{
    name?: string | null;
    number?: number | null;
    position?: string | null;
    age?: number | null;
  }>;
}

// Position sort order; anything unrecognized sorts last.
const POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Attacker: 3,
};

export function parseSquad(raw: ApiSquad[] | null | undefined): SquadPlayer[] {
  const entry = raw?.[0];
  const players = (entry?.players ?? []).flatMap((p) => {
    const name = p.name?.trim();
    if (!name) return [];
    return [{
      name,
      number: p.number ?? null,
      position: p.position?.trim() || null,
      age: p.age ?? null,
    }];
  });

  return players.sort((a, b) => {
    const pa = a.position != null ? (POSITION_ORDER[a.position] ?? 99) : 99;
    const pb = b.position != null ? (POSITION_ORDER[b.position] ?? 99) : 99;
    if (pa !== pb) return pa - pb;
    // Within a position, order by shirt number (missing numbers last).
    const na = a.number ?? 999;
    const nb = b.number ?? 999;
    return na - nb;
  });
}
