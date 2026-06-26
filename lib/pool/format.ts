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

// A fetch timestamp → a short "Updated …" freshness label, so a stale odds price
// or leaderboard reads as stale. Buckets: "just now" (<1m), "Nm/Nh/Nd ago", then
// a "Mon D" date past a week. Computed at request time (pages are force-dynamic).
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days}d ago`;
  return `Updated ${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: DISPLAY_TZ,
  })}`;
}

// The full timestamp in the display timezone — used as the title/tooltip behind a
// relative "Updated …" label so the exact fetch time is always one hover away.
export function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
    timeZoneName: "short",
  });
}
