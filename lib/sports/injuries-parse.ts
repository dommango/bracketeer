// Pure parser for API-Football's /injuries response — no env/network, so it's
// unit-tested directly. The fetch wrapper in client.ts binds it to env + network.
// Each injury already carries its team id, so we map straight to our 3-letter code
// and let the UI bucket into home/away by the match's resolved sides.

import { EXTERNAL_TEAM_CODES } from "@/lib/sports/fixtures-map";

export interface InjuryItem {
  teamCode: string; // internal 3-letter code
  playerName: string;
  type: string | null; // availability bucket, e.g. "Missing Fixture" / "Questionable"
  reason: string | null; // cause, e.g. "Knee Injury" / "Suspended"
}

// The slice of one /injuries response entry we read. In API-Football v3 the
// availability `type` and `reason` are nested under `player`, not at top level.
export interface ApiInjury {
  player?: { name?: string | null; type?: string | null; reason?: string | null } | null;
  team?: { id?: number | null } | null;
}

export function parseInjuries(resp: ApiInjury[]): InjuryItem[] {
  const out: InjuryItem[] = [];
  for (const it of resp) {
    const id = it.team?.id;
    const teamCode = id != null ? EXTERNAL_TEAM_CODES[String(id)] : undefined;
    const playerName = it.player?.name?.trim();
    // Drop entries we can't attribute to a tournament team or a named player.
    if (!teamCode || !playerName) continue;
    out.push({
      teamCode,
      playerName,
      type: it.player?.type?.trim() || null,
      reason: it.player?.reason?.trim() || null,
    });
  }
  return out;
}
