// Pure, DB-free builder that buckets every WC2026 match (1–104) into its host
// venue. Group games (1–72) resolve to real team-name matchups via the internal
// match numbering; knockouts (73–104) resolve to feeder slot labels. Used by the
// per-stadium schedule view. Kept allocation-light and side-effect-free so it's
// unit-testable and safe to call from server components.

import { HOST_CITIES, MATCH_CITY, kickoffFor, type CityToken } from "@/lib/scoring/schedule";
import { GROUPS, groupMatchups, TEAMS } from "@/lib/scoring/data";
import type { GroupLetter } from "@/lib/scoring/types";
import { matchTag, roundOf, roundLabel } from "./rounds";
import { slotLabel, KNOCKOUT_SLOT_REFS } from "./slot-label";

export interface StadiumMatch {
  matchNo: number;
  tag: string; // matchTag(), "" for group games
  round: string; // roundLabel(roundOf(matchNo))
  home: string; // team name (groups) or slot label (knockouts)
  away: string;
  kickoff: string | null; // ISO
}

export interface Stadium {
  token: string;
  city: string;
  venue: string;
  matches: StadiumMatch[]; // sorted by kickoff ascending (nulls last)
}

const GROUP_LETTERS = Object.keys(GROUPS) as GroupLetter[];

// Resolve a match number to its home/away display strings. Group games (1–72)
// map to real team names via the seed's numbering (group idx i owns i*6+1…i*6+6
// in groupMatchups order); knockouts (73–104) map to feeder slot labels.
export function matchup(matchNo: number): { home: string; away: string } {
  if (matchNo >= 1 && matchNo <= 72) {
    const idx = Math.floor((matchNo - 1) / 6);
    const local = (matchNo - 1) % 6;
    const [home, away] = groupMatchups(GROUP_LETTERS[idx])[local];
    return { home: TEAMS[home], away: TEAMS[away] };
  }
  const refs = KNOCKOUT_SLOT_REFS[matchNo];
  if (!refs) return { home: "TBD", away: "TBD" };
  return { home: slotLabel(refs[0]), away: slotLabel(refs[1]) };
}

function toStadiumMatch(matchNo: number): StadiumMatch {
  const { home, away } = matchup(matchNo);
  const kickoff = kickoffFor(matchNo);
  return {
    matchNo,
    tag: matchTag(matchNo),
    round: roundLabel(roundOf(matchNo)),
    home,
    away,
    kickoff: kickoff ? kickoff.toISOString() : null,
  };
}

// Compare two ISO-or-null kickoffs: ascending by time, nulls sorted last.
function byKickoff(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function buildStadiums(): Stadium[] {
  const buckets = new Map<CityToken, StadiumMatch[]>();
  for (let matchNo = 1; matchNo <= 104; matchNo++) {
    const token = MATCH_CITY[matchNo];
    if (!token) continue;
    const list = buckets.get(token);
    if (list) list.push(toStadiumMatch(matchNo));
    else buckets.set(token, [toStadiumMatch(matchNo)]);
  }

  const stadiums: Stadium[] = [];
  for (const [token, matches] of buckets) {
    const host = HOST_CITIES[token];
    stadiums.push({
      token,
      city: host.city,
      venue: host.venue,
      matches: [...matches].sort((a, b) => byKickoff(a.kickoff, b.kickoff)),
    });
  }

  // Sort venues by their earliest kickoff (nulls last), then by city name.
  return stadiums.sort((a, b) => {
    const ka = a.matches[0]?.kickoff ?? null;
    const kb = b.matches[0]?.kickoff ?? null;
    const k = byKickoff(ka, kb);
    return k !== 0 ? k : a.city.localeCompare(b.city);
  });
}

export function getStadium(token: string): Stadium | null {
  return buildStadiums().find((s) => s.token === token) ?? null;
}
