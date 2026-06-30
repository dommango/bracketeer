import { describe, it, expect } from "vitest";
import {
  dayKey,
  startOfDayUtcDaysAgo,
  eventsPerDay,
  activeUsersPerDay,
  distinctActiveUsers,
  countByType,
  topPoolsByEvents,
  stickiness,
  type EventRow,
} from "./aggregate";
import type { AnalyticsEventType } from "@/generated/prisma/enums";

// A fixed clock so every window/bucket assertion is deterministic.
const NOW = new Date("2026-06-30T12:00:00.000Z");

function ev(
  type: AnalyticsEventType,
  iso: string,
  userId: string | null = null,
  poolId: string | null = null,
): EventRow {
  return { type, userId, poolId, createdAt: new Date(iso) };
}

describe("dayKey / startOfDayUtcDaysAgo", () => {
  it("formats a UTC day key", () => {
    expect(dayKey(new Date("2026-06-30T23:59:59.000Z"))).toBe("2026-06-30");
  });

  it("walks back whole UTC days from midnight", () => {
    expect(startOfDayUtcDaysAgo(NOW, 0).toISOString()).toBe("2026-06-30T00:00:00.000Z");
    expect(startOfDayUtcDaysAgo(NOW, 6).toISOString()).toBe("2026-06-24T00:00:00.000Z");
  });
});

describe("eventsPerDay", () => {
  it("zero-fills and orders oldest → newest", () => {
    const rows = [
      ev("SIGN_IN", "2026-06-30T01:00:00Z"),
      ev("CHAT_MESSAGE", "2026-06-30T09:00:00Z"),
      ev("SIGN_IN", "2026-06-28T10:00:00Z"),
    ];
    const out = eventsPerDay(rows, 3, NOW);
    expect(out.map((d) => d.date)).toEqual(["2026-06-28", "2026-06-29", "2026-06-30"]);
    expect(out.map((d) => d.count)).toEqual([1, 0, 2]);
  });

  it("ignores rows older than the window", () => {
    const rows = [ev("SIGN_IN", "2026-06-20T10:00:00Z"), ev("SIGN_IN", "2026-06-30T10:00:00Z")];
    const out = eventsPerDay(rows, 3, NOW);
    expect(out.reduce((a, d) => a + d.count, 0)).toBe(1);
  });
});

describe("activeUsersPerDay", () => {
  it("counts a user once per day and skips anonymous rows", () => {
    const rows = [
      ev("SIGN_IN", "2026-06-30T01:00:00Z", "u1"),
      ev("CHAT_MESSAGE", "2026-06-30T02:00:00Z", "u1"), // same user, same day
      ev("SIGN_IN", "2026-06-30T03:00:00Z", "u2"),
      ev("REACTION", "2026-06-30T04:00:00Z", null), // anonymous → ignored
    ];
    const out = activeUsersPerDay(rows, 1, NOW);
    expect(out).toEqual([{ date: "2026-06-30", count: 2 }]);
  });
});

describe("distinctActiveUsers (DAU/WAU/MAU)", () => {
  const rows = [
    ev("SIGN_IN", "2026-06-30T06:00:00Z", "u1"), // within 24h
    ev("SIGN_IN", "2026-06-27T06:00:00Z", "u2"), // within 7d
    ev("SIGN_IN", "2026-06-10T06:00:00Z", "u3"), // within 30d
    ev("SIGN_IN", "2026-05-01T06:00:00Z", "u4"), // older than 30d
    ev("SIGN_IN", "2026-06-30T07:00:00Z", null), // anonymous
  ];

  it("DAU counts only the last 24h", () => {
    expect(distinctActiveUsers(rows, NOW, 1)).toBe(1);
  });
  it("WAU counts the last 7 days", () => {
    expect(distinctActiveUsers(rows, NOW, 7)).toBe(2);
  });
  it("MAU counts the last 30 days and dedupes users", () => {
    const dupd = [...rows, ev("CHAT_MESSAGE", "2026-06-29T06:00:00Z", "u1")];
    expect(distinctActiveUsers(dupd, NOW, 30)).toBe(3);
  });

  it("uses a half-open window (now-N, now] — the fetch must reach back this far", () => {
    const since = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000); // exactly 30d ago
    const justInside = new Date(since.getTime() + 1);
    const justOutside = since;
    expect(distinctActiveUsers([ev("SIGN_IN", justInside.toISOString(), "u9")], NOW, 30)).toBe(1);
    expect(distinctActiveUsers([ev("SIGN_IN", justOutside.toISOString(), "u9")], NOW, 30)).toBe(0);
  });
});

describe("countByType", () => {
  it("totals per type, descending with stable tie-break", () => {
    const rows = [
      ev("SIGN_IN", "2026-06-30T01:00:00Z"),
      ev("SIGN_IN", "2026-06-30T02:00:00Z"),
      ev("REACTION", "2026-06-30T03:00:00Z"),
      ev("CHAT_MESSAGE", "2026-06-30T04:00:00Z"),
    ];
    expect(countByType(rows)).toEqual([
      { type: "SIGN_IN", count: 2 },
      { type: "CHAT_MESSAGE", count: 1 }, // tie with REACTION → alpha order
      { type: "REACTION", count: 1 },
    ]);
  });
});

describe("topPoolsByEvents", () => {
  it("ranks pools by volume, skips null poolId, respects the limit", () => {
    const rows = [
      ev("CHAT_MESSAGE", "2026-06-30T01:00:00Z", "u1", "pA"),
      ev("CHAT_MESSAGE", "2026-06-30T02:00:00Z", "u2", "pA"),
      ev("REACTION", "2026-06-30T03:00:00Z", "u1", "pB"),
      ev("SIGN_IN", "2026-06-30T04:00:00Z", "u1", null), // no pool → ignored
    ];
    expect(topPoolsByEvents(rows, 1)).toEqual([{ poolId: "pA", count: 2 }]);
    expect(topPoolsByEvents(rows, 5)).toEqual([
      { poolId: "pA", count: 2 },
      { poolId: "pB", count: 1 },
    ]);
  });
});

describe("stickiness", () => {
  it("is DAU/MAU as a rounded percentage", () => {
    expect(stickiness(3, 12)).toBe(25);
    expect(stickiness(1, 3)).toBe(33);
  });
  it("is 0 when there are no monthly actives", () => {
    expect(stickiness(0, 0)).toBe(0);
  });
});
