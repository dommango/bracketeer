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
