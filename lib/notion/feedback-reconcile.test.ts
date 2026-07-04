import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the impure edges: DB, env, the sync module, and global fetch (the Notion
// "query by App Row ID" call). The reconciler's own control flow is what we test.
vi.mock("@/lib/db", () => ({
  prisma: { feedback: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/env", () => ({
  env: {
    NOTION_FEEDBACK_DB_ID: "central-db",
    NOTION_API_KEY: "secret",
    APP_BASE_URL: "https://app.test",
    NODE_ENV: "production",
  },
  notionEnabled: true,
}));
vi.mock("@/lib/notion/feedback-sync", () => ({ syncFeedbackToNotion: vi.fn() }));

import { prisma } from "@/lib/db";
import { syncFeedbackToNotion } from "@/lib/notion/feedback-sync";
import { reconcileFeedbackNotion } from "./feedback-reconcile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findMany = prisma.feedback.findMany as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = prisma.feedback.update as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sync = syncFeedbackToNotion as any;

function row(over: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    type: "BUG",
    title: "Broken",
    description: "details",
    pageUrl: "https://app.test/x",
    userEmail: "u@e.com",
    userAgent: "UA",
    screenshots: null,
    ...over,
  };
}

// Minimal fetch Response stub for the Notion query call.
function queryResponse(results: unknown[]) {
  return { ok: true, json: async () => ({ results }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("reconcileFeedbackNotion", () => {
  it("scans only unsynced, under-cap, aged rows (outbox query)", async () => {
    findMany.mockResolvedValue([]);
    await reconcileFeedbackNotion();
    const where = findMany.mock.calls[0][0].where;
    expect(where.notionSyncedAt).toBeNull();
    expect(where.notionSyncAttempts).toEqual({ lt: 5 });
    expect(where.createdAt.lt).toBeInstanceOf(Date);
    expect(findMany.mock.calls[0][0].take).toBe(20);
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "asc" });
  });

  it("creates a page when Notion has none, then writes back id+url", async () => {
    findMany.mockResolvedValue([row()]);
    vi.stubGlobal("fetch", vi.fn(async () => queryResponse([])));
    sync.mockResolvedValue({ pageId: "pg-9", url: "https://notion/pg-9" });

    const result = await reconcileFeedbackNotion();

    expect(sync).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: { notionPageId: "pg-9", notionUrl: "https://notion/pg-9", notionSyncedAt: expect.any(Date) },
    });
    expect(result).toEqual({ processed: 1, created: 1, backfilled: 0 });
  });

  it("backfills from an existing Notion page WITHOUT creating a duplicate", async () => {
    findMany.mockResolvedValue([row()]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => queryResponse([{ id: "pg-existing", url: "https://notion/pg-existing" }])),
    );

    const result = await reconcileFeedbackNotion();

    expect(sync).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: {
        notionPageId: "pg-existing",
        notionUrl: "https://notion/pg-existing",
        notionSyncedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ processed: 1, created: 0, backfilled: 1 });
  });

  it("records an attempt + error when the sync returns null", async () => {
    findMany.mockResolvedValue([row()]);
    vi.stubGlobal("fetch", vi.fn(async () => queryResponse([])));
    sync.mockResolvedValue(null);

    const result = await reconcileFeedbackNotion();

    expect(update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: { notionSyncAttempts: { increment: 1 }, notionLastError: "sync returned null" },
    });
    expect(result).toEqual({ processed: 1, created: 0, backfilled: 0 });
  });

  it("records an attempt (no create) when the Notion query itself fails", async () => {
    findMany.mockResolvedValue([row()]);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502, text: async () => "err" })));

    const result = await reconcileFeedbackNotion();

    expect(sync).not.toHaveBeenCalled();
    const call = update.mock.calls[0][0];
    expect(call.data.notionSyncAttempts).toEqual({ increment: 1 });
    expect(result).toEqual({ processed: 1, created: 0, backfilled: 0 });
  });

  it("builds screenshot URLs from APP_BASE_URL for rows with screenshots", async () => {
    findMany.mockResolvedValue([row({ screenshots: ["data:...", "data:..."] })]);
    vi.stubGlobal("fetch", vi.fn(async () => queryResponse([])));
    sync.mockResolvedValue({ pageId: "pg", url: "https://notion/pg" });

    await reconcileFeedbackNotion();

    expect(sync.mock.calls[0][0].screenshotUrls).toEqual([
      "https://app.test/api/feedback/screenshots/row-1/0",
      "https://app.test/api/feedback/screenshots/row-1/1",
    ]);
    expect(sync.mock.calls[0][0].environment).toBe("Production");
  });

  it("is idempotent across a double-run: the second run backfills, never re-creates", async () => {
    // Run 1: no page yet → create.
    findMany.mockResolvedValueOnce([row()]);
    vi.stubGlobal("fetch", vi.fn(async () => queryResponse([])));
    sync.mockResolvedValue({ pageId: "pg-1", url: "https://notion/pg-1" });
    const first = await reconcileFeedbackNotion();
    expect(first.created).toBe(1);

    // Run 2: writeback was lost (row still unsynced) but the page now exists →
    // backfill, no second create.
    findMany.mockResolvedValueOnce([row()]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => queryResponse([{ id: "pg-1", url: "https://notion/pg-1" }])),
    );
    const second = await reconcileFeedbackNotion();

    expect(second).toEqual({ processed: 1, created: 0, backfilled: 1 });
    expect(sync).toHaveBeenCalledTimes(1); // still only the first run's create
  });
});
