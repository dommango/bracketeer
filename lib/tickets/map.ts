// Pure, DB-free matching of an external ticket listing (Ticketmaster / SeatGeek)
// to an internal WC2026 matchNo. Listings carry a venue + city + start time but
// no internal id and — for knockout fixtures — no team names. So we match on
// (host city) + (kickoff proximity): at most one WC match runs at a given venue
// within a half-day window, which makes the pair unique.

import { MATCH_CITY, MATCH_KICKOFF_UTC, type CityToken } from "@/lib/scoring/schedule";

export interface TicketEvent {
  startUtc: string | null; // ISO
  venueName: string | null;
  city: string | null;
}

// Distinctive normalized venue substrings → host-city token. The primary signal:
// venue names are stable and unambiguous across ticketing providers.
const VENUE_TOKEN: Array<[string, CityToken]> = [
  ["mercedesbenz", "atlanta"],
  ["gillette", "boston"],
  ["att", "dallas"], // AT&T Stadium, Arlington
  ["akron", "guadalajara"],
  ["nrg", "houston"],
  ["arrowhead", "kansas-city"],
  ["sofi", "los-angeles"],
  ["azteca", "mexico-city"],
  ["banorte", "mexico-city"], // Azteca's sponsored name, in case a provider uses it
  ["hardrock", "miami"],
  ["bbva", "monterrey"],
  ["metlife", "new-york-nj"],
  ["lincolnfinancial", "philadelphia"],
  ["levis", "san-francisco"],
  ["lumen", "seattle"],
  ["bmofield", "toronto"],
  ["bcplace", "vancouver"],
];

// Fallback: host/suburb city name → token. WC venues sit in suburbs a listing
// may name instead of the metro (SoFi is in Inglewood, MetLife in East Rutherford…).
const CITY_ALIAS: Record<string, CityToken> = {
  atlanta: "atlanta",
  foxborough: "boston",
  boston: "boston",
  arlington: "dallas",
  dallas: "dallas",
  guadalajara: "guadalajara",
  zapopan: "guadalajara",
  houston: "houston",
  "kansas city": "kansas-city",
  inglewood: "los-angeles",
  "los angeles": "los-angeles",
  "mexico city": "mexico-city",
  "ciudad de mexico": "mexico-city",
  "miami gardens": "miami",
  miami: "miami",
  monterrey: "monterrey",
  guadalupe: "monterrey",
  "east rutherford": "new-york-nj",
  "new york": "new-york-nj",
  "new jersey": "new-york-nj",
  philadelphia: "philadelphia",
  "santa clara": "san-francisco",
  "san francisco": "san-francisco",
  seattle: "seattle",
  toronto: "toronto",
  vancouver: "vancouver",
};

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const normCity = (s: string): string =>
  s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

// The host-city token a listing belongs to — by venue name first, city second.
export function cityTokenForEvent(ev: TicketEvent): CityToken | null {
  if (ev.venueName) {
    const v = norm(ev.venueName);
    for (const [token, city] of VENUE_TOKEN) {
      if (v.includes(token)) return city;
    }
  }
  if (ev.city) {
    const token = CITY_ALIAS[normCity(ev.city)];
    if (token) return token;
  }
  return null;
}

// Internal match slots: matchNo → { kickoffMs, cityToken }. Built from the static
// schedule (kickoff + host city are public, fixed data).
export interface MatchSlot {
  matchNo: number;
  kickoffMs: number;
  cityToken: CityToken;
}

export function wc2026Slots(): MatchSlot[] {
  const slots: MatchSlot[] = [];
  for (const [noStr, city] of Object.entries(MATCH_CITY)) {
    const matchNo = Number(noStr);
    const iso = MATCH_KICKOFF_UTC[matchNo];
    if (!iso) continue;
    slots.push({ matchNo, kickoffMs: new Date(iso).getTime(), cityToken: city });
  }
  return slots;
}

// At most one WC match runs at a venue within this window of a listing's start.
const TOLERANCE_MS = 12 * 60 * 60 * 1000;

// The internal matchNo a listing maps to, or null when the city is unknown or no
// match sits within the tolerance. Picks the closest kickoff when several share
// the venue (defensive — there should only ever be one in-window).
export function resolveTicketMatchNo(ev: TicketEvent, slots: MatchSlot[]): number | null {
  const token = cityTokenForEvent(ev);
  if (!token || !ev.startUtc) return null;
  const startMs = new Date(ev.startUtc).getTime();
  if (Number.isNaN(startMs)) return null;

  let best: { matchNo: number; diff: number } | null = null;
  for (const s of slots) {
    if (s.cityToken !== token) continue;
    const diff = Math.abs(s.kickoffMs - startMs);
    if (diff > TOLERANCE_MS) continue;
    if (!best || diff < best.diff) best = { matchNo: s.matchNo, diff };
  }
  return best?.matchNo ?? null;
}
