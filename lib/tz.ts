// The pool's display timezone. The WC2026 MVP is a US-Eastern friend group, so
// kickoff times and the daily "today" boundary are pinned to Eastern rather than
// the server zone (UTC on Railway) or each viewer's browser. Uses the IANA zone
// so EST/EDT (and the DST switch) are handled automatically — during the
// tournament this resolves to EDT (UTC−4).
export const DISPLAY_TZ = "America/New_York";

// Eastern's UTC offset in minutes for a given instant (negative west of UTC,
// e.g. −240 for EDT, −300 for EST). Derived from the zone's formatted offset so
// it tracks DST without a date library.
function offsetMinutes(at: Date, timeZone: string): number {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT-04:00"
  const m = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0; // "GMT" with no offset = UTC
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

// The UTC instant of the start of the Eastern-time day containing `now`
// (i.e. the most recent Eastern midnight). DST-correct.
export function startOfDayInZone(now: Date = new Date(), timeZone: string = DISPLAY_TZ): Date {
  // Calendar Y-M-D for `now` in the target zone (en-CA renders as YYYY-MM-DD).
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  // Probe the offset at that local date (noon avoids DST-transition edge hours),
  // then shift local-midnight back to the real UTC instant.
  const offset = offsetMinutes(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), timeZone);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset * 60_000);
}
