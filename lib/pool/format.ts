// Shared display formatters for pool screens.

// A kickoff timestamp (ISO string) → short weekday/date/time, e.g. "Sat, Jun 27, 7:00 PM".
export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
