// Admin analytics: fetch the trailing window of events once, then hand the rows
// to the pure rollups in aggregate.ts. Structural totals (users/pools/entries)
// come straight from their tables; engagement metrics come from AnalyticsEvent.
// Read by the super-admin dashboard (app/admin/analytics/page.tsx).

import { prisma } from "@/lib/db";
import {
  eventsPerDay,
  activeUsersPerDay,
  distinctActiveUsers,
  countByType,
  topPoolsByEvents,
  stickiness,
  startOfDayUtcDaysAgo,
  type EventRow,
  type DayBucket,
} from "./aggregate";
import type { AnalyticsEventType } from "@/generated/prisma/enums";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_POOLS = 8;

export interface AdminAnalytics {
  windowDays: number;
  totals: { users: number; pools: number; entries: number; events: number };
  newUsers: { last7d: number; last30d: number };
  active: { dau: number; wau: number; mau: number; stickiness: number };
  eventsPerDay: DayBucket[];
  activeUsersPerDay: DayBucket[];
  byType: { type: AnalyticsEventType; count: number }[];
  topPools: { poolId: string; name: string; count: number }[];
}

export async function getAdminAnalytics(
  now: Date = new Date(),
  windowDays = 30,
): Promise<AdminAnalytics> {
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);
  // Fetch from the earliest boundary either consumer needs: the start of the
  // oldest chart day (midnight, windowDays-1 ago) OR the rolling MAU window start
  // (now - 30d). The latter is up to ~24h earlier, so anchoring only on the chart
  // day would clip late-in-the-day actives from MAU and overstate stickiness.
  const earliest = new Date(
    Math.min(startOfDayUtcDaysAgo(now, windowDays - 1).getTime(), d30.getTime()),
  );

  const [users, pools, entries, events, newUsers7, newUsers30, rawRows] = await Promise.all([
    prisma.user.count(),
    prisma.pool.count(),
    prisma.entry.count(),
    prisma.analyticsEvent.count(),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    prisma.analyticsEvent.findMany({
      where: { createdAt: { gte: earliest } },
      select: { type: true, userId: true, poolId: true, createdAt: true },
    }),
  ]);

  const rows: EventRow[] = rawRows;

  const dau = distinctActiveUsers(rows, now, 1);
  const wau = distinctActiveUsers(rows, now, 7);
  const mau = distinctActiveUsers(rows, now, 30);

  const top = topPoolsByEvents(rows, TOP_POOLS);
  const poolRows = top.length
    ? await prisma.pool.findMany({
        where: { id: { in: top.map((p) => p.poolId) } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(poolRows.map((p) => [p.id, p.name]));

  return {
    windowDays,
    totals: { users, pools, entries, events },
    newUsers: { last7d: newUsers7, last30d: newUsers30 },
    active: { dau, wau, mau, stickiness: stickiness(dau, mau) },
    eventsPerDay: eventsPerDay(rows, windowDays, now),
    activeUsersPerDay: activeUsersPerDay(rows, windowDays, now),
    byType: countByType(rows),
    topPools: top.map((p) => ({
      poolId: p.poolId,
      name: nameById.get(p.poolId) ?? "Unknown pool",
      count: p.count,
    })),
  };
}
