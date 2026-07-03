// Outbox reconciler for the feedback → central Notion sync. Scans rows whose
// Notion page was never confirmed (notionSyncedAt IS NULL) and pushes them, so a
// crash between the DB write and the after() sync never loses feedback. Idempotent
// by design: it FIRST queries Notion by "App Row ID" (the write-once idempotency
// key) and backfills an existing page rather than creating a duplicate — the
// crash-after-create window is safe. Run on a cron cadence. Never throws per row.

import { prisma } from "@/lib/db";
import { env, notionEnabled } from "@/lib/env";
import { syncFeedbackToNotion } from "@/lib/notion/feedback-sync";
import { feedbackScreenshotUrls } from "@/lib/feedback/screenshot-urls";
import type { FeedbackType } from "@/generated/prisma/enums";

const NOTION_VERSION = "2022-06-28";
const TIMEOUT_MS = 8_000;
const BATCH = 20;
const MAX_ATTEMPTS = 5;
// Skip very fresh rows: the submit-path after() sync is probably still in flight,
// so give it a grace window before the reconciler competes with it.
const MIN_AGE_MS = 2 * 60_000;

export interface ReconcileSummary {
  processed: number;
  created: number;
  backfilled: number;
}

// Query the central DB for an existing page carrying this App Row ID. Returns the
// page id+url if one exists, null if none. THROWS on a failed query so the caller
// records an attempt and retries later — never silently proceeds to create (which
// could duplicate a page the query simply failed to see).
async function findExistingNotionPage(
  rowId: string,
): Promise<{ id: string; url: string } | null> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${env.NOTION_FEEDBACK_DB_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "App Row ID", rich_text: { equals: rowId } },
        page_size: 1,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Notion query ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { results?: Array<{ id?: string; url?: string }> };
  const first = json.results?.[0];
  if (first?.id && first?.url) return { id: first.id, url: first.url };
  return null;
}

function screenshotCount(screenshots: unknown): number {
  return Array.isArray(screenshots) ? screenshots.length : 0;
}

export async function reconcileFeedbackNotion(): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { processed: 0, created: 0, backfilled: 0 };
  if (!notionEnabled) return summary;

  const rows = await prisma.feedback.findMany({
    where: {
      notionSyncedAt: null,
      notionSyncAttempts: { lt: MAX_ATTEMPTS },
      createdAt: { lt: new Date(Date.now() - MIN_AGE_MS) },
    },
    take: BATCH,
    orderBy: { createdAt: "asc" },
  });

  const environment = env.NODE_ENV === "production" ? "Production" : "Development";

  for (const r of rows) {
    summary.processed += 1;
    try {
      const existing = await findExistingNotionPage(r.id);
      if (existing) {
        await prisma.feedback.update({
          where: { id: r.id },
          data: { notionPageId: existing.id, notionUrl: existing.url, notionSyncedAt: new Date() },
        });
        summary.backfilled += 1;
        continue;
      }

      const urls = feedbackScreenshotUrls(r.id, screenshotCount(r.screenshots));
      const res = await syncFeedbackToNotion({
        id: r.id,
        type: r.type as FeedbackType,
        title: r.title,
        description: r.description,
        pageUrl: r.pageUrl,
        userEmail: r.userEmail,
        userAgent: r.userAgent,
        screenshotUrls: urls,
        environment,
      });
      if (res) {
        await prisma.feedback.update({
          where: { id: r.id },
          data: { notionPageId: res.pageId, notionUrl: res.url, notionSyncedAt: new Date() },
        });
        summary.created += 1;
      } else {
        await prisma.feedback.update({
          where: { id: r.id },
          data: { notionSyncAttempts: { increment: 1 }, notionLastError: "sync returned null" },
        });
      }
    } catch (e) {
      await prisma.feedback
        .update({
          where: { id: r.id },
          data: { notionSyncAttempts: { increment: 1 }, notionLastError: String(e).slice(0, 500) },
        })
        .catch(() => {});
    }
  }

  return summary;
}
