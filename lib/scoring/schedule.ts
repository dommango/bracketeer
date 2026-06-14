// Static venue data for WC2026. Venues are fixed and public, so this is a
// dependency-free source of truth keyed by internal matchNo. Each match maps to
// one host-city token; venue/city/accent all derive from HOST_CITIES so they
// stay consistent. Tokens match the --city-* palette in app/globals.css.

export interface HostCity { city: string; venue: string }

export type CityToken =
  | "atlanta" | "boston" | "dallas" | "guadalajara" | "houston" | "kansas-city"
  | "los-angeles" | "mexico-city" | "miami" | "monterrey" | "new-york-nj"
  | "philadelphia" | "san-francisco" | "seattle" | "toronto" | "vancouver";

export const HOST_CITIES: Record<CityToken, HostCity> = {
  "atlanta":       { city: "Atlanta",                venue: "Mercedes-Benz Stadium" },
  "boston":        { city: "Boston",                 venue: "Gillette Stadium" },
  "dallas":        { city: "Dallas",                 venue: "AT&T Stadium" },
  "guadalajara":   { city: "Guadalajara",            venue: "Estadio Akron" },
  "houston":       { city: "Houston",                venue: "NRG Stadium" },
  "kansas-city":   { city: "Kansas City",            venue: "Arrowhead Stadium" },
  "los-angeles":   { city: "Los Angeles",            venue: "SoFi Stadium" },
  "mexico-city":   { city: "Mexico City",            venue: "Estadio Azteca" },
  "miami":         { city: "Miami",                  venue: "Hard Rock Stadium" },
  "monterrey":     { city: "Monterrey",              venue: "Estadio BBVA" },
  "new-york-nj":   { city: "New York / New Jersey",  venue: "MetLife Stadium" },
  "philadelphia":  { city: "Philadelphia",           venue: "Lincoln Financial Field" },
  "san-francisco": { city: "San Francisco Bay Area", venue: "Levi's Stadium" },
  "seattle":       { city: "Seattle",                venue: "Lumen Field" },
  "toronto":       { city: "Toronto",                venue: "BMO Field" },
  "vancouver":     { city: "Vancouver",              venue: "BC Place" },
};

// matchNo (1–104) -> host-city token. Sourced from the official WC2026 schedule.
// Group matches (1–72) are mapped by the actual team pair (group + slot-pair as
// defined in data.ts); knockout matches (73–104) share FIFA's match numbering
// (verified: our R32 slot descriptors and the R16→Final winner-feeder topology
// match FIFA's bracket exactly), so they map by id directly.
export const MATCH_CITY: Record<number, CityToken> = {
  // Group A
  1: "mexico-city", 2: "guadalajara", 3: "mexico-city", 4: "monterrey", 5: "atlanta", 6: "guadalajara",
  // Group B
  7: "toronto", 8: "vancouver", 9: "vancouver", 10: "seattle", 11: "los-angeles", 12: "san-francisco",
  // Group C
  13: "new-york-nj", 14: "philadelphia", 15: "miami", 16: "atlanta", 17: "boston", 18: "boston",
  // Group D
  19: "los-angeles", 20: "seattle", 21: "los-angeles", 22: "san-francisco", 23: "san-francisco", 24: "vancouver",
  // Group E
  25: "houston", 26: "toronto", 27: "new-york-nj", 28: "philadelphia", 29: "kansas-city", 30: "philadelphia",
  // Group F
  31: "dallas", 32: "houston", 33: "kansas-city", 34: "dallas", 35: "monterrey", 36: "monterrey",
  // Group G
  37: "vancouver", 38: "los-angeles", 39: "vancouver", 40: "seattle", 41: "vancouver", 42: "los-angeles",
  // Group H
  43: "atlanta", 44: "atlanta", 45: "guadalajara", 46: "houston", 47: "miami", 48: "miami",
  // Group I
  49: "new-york-nj", 50: "philadelphia", 51: "boston", 52: "toronto", 53: "new-york-nj", 54: "boston",
  // Group J
  55: "kansas-city", 56: "dallas", 57: "dallas", 58: "kansas-city", 59: "san-francisco", 60: "san-francisco",
  // Group K
  61: "houston", 62: "houston", 63: "miami", 64: "atlanta", 65: "guadalajara", 66: "mexico-city",
  // Group L
  67: "dallas", 68: "boston", 69: "new-york-nj", 70: "philadelphia", 71: "toronto", 72: "toronto",
  // Round of 32
  73: "los-angeles", 74: "boston", 75: "monterrey", 76: "houston",
  77: "new-york-nj", 78: "dallas", 79: "mexico-city", 80: "atlanta",
  81: "san-francisco", 82: "seattle", 83: "toronto", 84: "los-angeles",
  85: "vancouver", 86: "miami", 87: "kansas-city", 88: "dallas",
  // Round of 16
  89: "philadelphia", 90: "houston", 91: "new-york-nj", 92: "mexico-city",
  93: "dallas", 94: "seattle", 95: "atlanta", 96: "vancouver",
  // Quarter-finals
  97: "boston", 98: "los-angeles", 99: "miami", 100: "kansas-city",
  // Semi-finals
  101: "dallas", 102: "atlanta",
  // Third place + Final
  103: "miami", 104: "new-york-nj",
};

export function venueFor(
  matchNo: number,
): { venue: string; city: string; cityToken: CityToken } | null {
  const token = MATCH_CITY[matchNo];
  if (!token) return null;
  const c = HOST_CITIES[token];
  return { venue: c.venue, city: c.city, cityToken: token };
}

// matchNo (1–104) -> kickoff as a UTC instant (ISO-8601 Z). Sourced from the
// official WC2026 schedule (Wikipedia per-group + knockout fixture tables, cross-
// checked against MATCH_CITY by host city). Stored as the absolute UTC instant so
// no runtime timezone math is needed; display layers convert to the viewer tz.
// This is the single source of truth for kickoff times (the date strings in
// data.ts are vestigial and no longer drive scheduling).
export const MATCH_KICKOFF_UTC: Record<number, string> = {
  // Group stage (1–72)
  1: "2026-06-11T19:00:00Z", 2: "2026-06-19T01:00:00Z", 3: "2026-06-25T01:00:00Z",
  4: "2026-06-25T01:00:00Z", 5: "2026-06-18T16:00:00Z", 6: "2026-06-12T02:00:00Z",
  7: "2026-06-12T19:00:00Z", 8: "2026-06-18T22:00:00Z", 9: "2026-06-24T19:00:00Z",
  10: "2026-06-24T19:00:00Z", 11: "2026-06-18T19:00:00Z", 12: "2026-06-13T19:00:00Z",
  13: "2026-06-13T22:00:00Z", 14: "2026-06-20T00:30:00Z", 15: "2026-06-24T22:00:00Z",
  16: "2026-06-24T22:00:00Z", 17: "2026-06-19T22:00:00Z", 18: "2026-06-14T01:00:00Z",
  19: "2026-06-13T01:00:00Z", 20: "2026-06-19T19:00:00Z", 21: "2026-06-26T02:00:00Z",
  22: "2026-06-26T02:00:00Z", 23: "2026-06-20T03:00:00Z", 24: "2026-06-14T04:00:00Z",
  25: "2026-06-14T17:00:00Z", 26: "2026-06-20T20:00:00Z", 27: "2026-06-25T20:00:00Z",
  28: "2026-06-25T20:00:00Z", 29: "2026-06-21T00:00:00Z", 30: "2026-06-14T23:00:00Z",
  31: "2026-06-14T20:00:00Z", 32: "2026-06-20T17:00:00Z", 33: "2026-06-25T23:00:00Z",
  34: "2026-06-25T23:00:00Z", 35: "2026-06-21T04:00:00Z", 36: "2026-06-15T02:00:00Z",
  37: "2026-06-15T19:00:00Z", 38: "2026-06-21T19:00:00Z", 39: "2026-06-27T03:00:00Z",
  40: "2026-06-27T03:00:00Z", 41: "2026-06-22T01:00:00Z", 42: "2026-06-16T01:00:00Z",
  43: "2026-06-15T16:00:00Z", 44: "2026-06-21T16:00:00Z", 45: "2026-06-27T00:00:00Z",
  46: "2026-06-27T00:00:00Z", 47: "2026-06-21T22:00:00Z", 48: "2026-06-15T22:00:00Z",
  49: "2026-06-16T19:00:00Z", 50: "2026-06-22T21:00:00Z", 51: "2026-06-26T19:00:00Z",
  52: "2026-06-26T19:00:00Z", 53: "2026-06-23T00:00:00Z", 54: "2026-06-16T22:00:00Z",
  55: "2026-06-17T01:00:00Z", 56: "2026-06-22T17:00:00Z", 57: "2026-06-28T02:00:00Z",
  58: "2026-06-28T02:00:00Z", 59: "2026-06-23T03:00:00Z", 60: "2026-06-17T04:00:00Z",
  61: "2026-06-17T17:00:00Z", 62: "2026-06-23T17:00:00Z", 63: "2026-06-27T23:30:00Z",
  64: "2026-06-27T23:30:00Z", 65: "2026-06-24T02:00:00Z", 66: "2026-06-18T02:00:00Z",
  67: "2026-06-17T20:00:00Z", 68: "2026-06-23T20:00:00Z", 69: "2026-06-27T21:00:00Z",
  70: "2026-06-27T21:00:00Z", 71: "2026-06-23T23:00:00Z", 72: "2026-06-17T23:00:00Z",
  // Round of 32 (73–88)
  73: "2026-06-28T19:00:00Z", 74: "2026-06-29T20:30:00Z", 75: "2026-06-30T01:00:00Z",
  76: "2026-06-29T17:00:00Z", 77: "2026-06-30T21:00:00Z", 78: "2026-06-30T17:00:00Z",
  79: "2026-07-01T01:00:00Z", 80: "2026-07-01T16:00:00Z", 81: "2026-07-02T00:00:00Z",
  82: "2026-07-01T20:00:00Z", 83: "2026-07-02T23:00:00Z", 84: "2026-07-02T19:00:00Z",
  85: "2026-07-03T03:00:00Z", 86: "2026-07-03T22:00:00Z", 87: "2026-07-04T01:30:00Z",
  88: "2026-07-03T18:00:00Z",
  // Round of 16 (89–96)
  89: "2026-07-04T21:00:00Z", 90: "2026-07-04T17:00:00Z", 91: "2026-07-05T20:00:00Z",
  92: "2026-07-06T00:00:00Z", 93: "2026-07-06T19:00:00Z", 94: "2026-07-07T00:00:00Z",
  95: "2026-07-07T16:00:00Z", 96: "2026-07-07T20:00:00Z",
  // Quarter-finals (97–100)
  97: "2026-07-09T20:00:00Z", 98: "2026-07-10T19:00:00Z", 99: "2026-07-11T21:00:00Z",
  100: "2026-07-12T01:00:00Z",
  // Semi-finals (101–102)
  101: "2026-07-14T19:00:00Z", 102: "2026-07-15T19:00:00Z",
  // Third place (103) + Final (104)
  103: "2026-07-18T21:00:00Z", 104: "2026-07-19T19:00:00Z",
};

export function kickoffFor(matchNo: number): Date | null {
  const iso = MATCH_KICKOFF_UTC[matchNo];
  return iso ? new Date(iso) : null;
}
