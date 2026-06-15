// Re-groupings of the fixture score cards for the matches page. Pure functions
// over MatchCenterRow[]; the matches page picks one based on the `fx` view param
// (by group / by day / by city). All groupings sort chronologically by kickoff.

import type { MatchCenterRow, MatchCenterSection } from "./match-center";
import { formatMatchDate } from "./format";
import { HOST_CITIES, type CityToken } from "@/lib/scoring/schedule";

// Kickoff order, nulls (unscheduled) last; ties broken by matchNo for stability.
function byKickoff(a: MatchCenterRow, b: MatchCenterRow): number {
  const ta = a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity;
  const tb = b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity;
  if (ta !== tb) return ta - tb;
  return a.matchNo - b.matchNo;
}

export function sortChrono(rows: MatchCenterRow[]): MatchCenterRow[] {
  return [...rows].sort(byKickoff);
}

// Existing group-letter sections, but matches chronological within each and a
// scroll anchor (group-A …) attached so the standings cards can deep-link in.
export function byGroupSections(groupSections: MatchCenterSection[]): MatchCenterSection[] {
  return groupSections.map((s) => {
    const letter = s.label.replace(/^Group\s+/i, "").trim();
    return { ...s, matches: sortChrono(s.matches), anchor: `group-${letter}` };
  });
}

// One section per calendar day (Eastern), chronological, "Date TBD" last.
// Map preserves first-insertion order, so iterating the chrono-sorted rows keeps
// days in order with the unscheduled bucket last.
export function byDaySections(rows: MatchCenterRow[]): MatchCenterSection[] {
  const buckets = new Map<string, MatchCenterRow[]>();
  for (const m of sortChrono(rows)) {
    const label = m.scheduledAt ? formatMatchDate(m.scheduledAt) : "Date TBD";
    buckets.set(label, [...(buckets.get(label) ?? []), m]);
  }
  return [...buckets.entries()].map(([label, matches]) => ({
    roundCode: "GROUP",
    label,
    matches,
  }));
}

export interface VenueCard {
  token: string;
  city: string;
  venue: string;
  count: number;
  firstKickoff: string | null;
}

// One card per host venue, ordered by earliest kickoff (first-appearance over the
// chrono-sorted rows). City/venue strings fall back to the static HOST_CITIES.
export function byCityVenues(rows: MatchCenterRow[]): VenueCard[] {
  const buckets = new Map<string, MatchCenterRow[]>();
  for (const m of sortChrono(rows)) {
    if (!m.cityToken) continue;
    buckets.set(m.cityToken, [...(buckets.get(m.cityToken) ?? []), m]);
  }
  return [...buckets.entries()].map(([token, ms]) => {
    const hc = HOST_CITIES[token as CityToken];
    return {
      token,
      city: ms[0].city ?? hc?.city ?? token,
      venue: ms[0].venue ?? hc?.venue ?? "",
      count: ms.length,
      firstKickoff: ms[0].scheduledAt,
    };
  });
}
