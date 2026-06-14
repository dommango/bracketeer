// Shared display formatters for pool screens.

import { DISPLAY_TZ } from "@/lib/tz";

// A kickoff timestamp (ISO string) → short weekday/date/time in the pool's display
// timezone (Eastern), e.g. "Sat, Jun 27, 3:00 PM EDT". Pinned to DISPLAY_TZ so the
// time is the same for everyone and never follows the server zone (UTC on Railway).
export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
    timeZoneName: "short",
  });
}

// A kickoff timestamp (ISO string) → short weekday/date only in the display
// timezone, e.g. "Sat, Jun 27" — for stage/group summaries where the time isn't
// relevant. Pinned to DISPLAY_TZ like formatKickoff.
export function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: DISPLAY_TZ,
  });
}
