// Pure rollups over raw analytics-event rows — no DB, no clock. Every function
// takes its `now` explicitly so the math is deterministic and unit-testable
// (lib/analytics/aggregate.test.ts). lib/analytics/queries.ts fetches the rows
// and feeds them here. Days are bucketed in UTC so boundaries are stable
// regardless of the server timezone.

import type { AnalyticsEventType } from "@/generated/prisma/enums";

export interface EventRow {
  type: AnalyticsEventType;
  userId: string | null;
  poolId: string | null;
  createdAt: Date;
}

export interface DayBucket {
  date: string; // UTC YYYY-MM-DD
  count: number;
}

export interface PoolCount {
  poolId: string;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// UTC calendar day key for a timestamp, e.g. "2026-06-30".
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Midnight (00:00:00.000 UTC) of the day that is `n` days before `now`.
// n=0 → start of today, n=6 → start of the day six days ago.
export function startOfDayUtcDaysAgo(now: Date, n: number): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// An ordered map of the last `days` UTC day-keys (oldest → newest), each seeded
// with the result of `seed()`. Insertion order is preserved by Map, so callers
// can emit a continuous, zero-filled x-axis.
function emptyDays<T>(days: number, now: Date, seed: () => T): Map<string, T> {
  const out = new Map<string, T>();
  for (let i = days - 1; i >= 0; i--) {
    out.set(dayKey(startOfDayUtcDaysAgo(now, i)), seed());
  }
  return out;
}

// Total events per UTC day across the trailing `days` window, oldest → newest,
// zero-filled. Rows older than the window are ignored.
export function eventsPerDay(rows: EventRow[], days: number, now: Date): DayBucket[] {
  const counts = emptyDays(days, now, () => 0);
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    const cur = counts.get(k);
    if (cur !== undefined) counts.set(k, cur + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

// Distinct active users per UTC day (a user counts once per day, on any event),
// oldest → newest, zero-filled. Events with no userId are ignored.
export function activeUsersPerDay(rows: EventRow[], days: number, now: Date): DayBucket[] {
  const sets = emptyDays(days, now, () => new Set<string>());
  for (const r of rows) {
    if (!r.userId) continue;
    const s = sets.get(dayKey(r.createdAt));
    if (s) s.add(r.userId);
  }
  return [...sets.entries()].map(([date, s]) => ({ date, count: s.size }));
}

// Distinct users with any event in the trailing window (now - windowDays, now].
// DAU → windowDays=1, WAU → 7, MAU → 30.
export function distinctActiveUsers(rows: EventRow[], now: Date, windowDays: number): number {
  const since = new Date(now.getTime() - windowDays * DAY_MS);
  const users = new Set<string>();
  for (const r of rows) {
    if (r.userId && r.createdAt > since && r.createdAt <= now) users.add(r.userId);
  }
  return users.size;
}

// Total events per type, descending by count (ties broken by type name so the
// order is stable).
export function countByType(rows: EventRow[]): { type: AnalyticsEventType; count: number }[] {
  const counts = new Map<AnalyticsEventType, number>();
  for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

// The most active pools by event volume, descending, capped at `limit`. Events
// with no poolId (sign-in, sign-up) are ignored.
export function topPoolsByEvents(rows: EventRow[], limit: number): PoolCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.poolId) continue;
    counts.set(r.poolId, (counts.get(r.poolId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([poolId, count]) => ({ poolId, count }))
    .sort((a, b) => b.count - a.count || a.poolId.localeCompare(b.poolId))
    .slice(0, limit);
}

// DAU/MAU stickiness as a whole-number percentage (0 when there are no monthly
// actives).
export function stickiness(dau: number, mau: number): number {
  if (mau <= 0) return 0;
  return Math.round((dau / mau) * 100);
}
