// Persist an in-app feedback submission, then mirror it to the central Notion DB
// out of the request path via Next's `after()`. The DB write is the source of
// truth; the Notion sync is an outbox — it runs after the response is sent, and a
// reconciler (lib/notion/feedback-reconcile.ts) retries anything it misses. The
// sync never fails the submission.

import { after } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { FeedbackType } from "@/generated/prisma/enums";
import { syncFeedbackToNotion } from "@/lib/notion/feedback-sync";
import { feedbackScreenshotUrls } from "@/lib/feedback/screenshot-urls";

export interface FeedbackInput {
  type: FeedbackType;
  title: string;
  description?: string;
  pageUrl?: string;
  userAgent?: string;
  // Base64 data-URL screenshots (already size-capped at the route boundary).
  screenshots?: string[];
  userId?: string | null;
  userEmail?: string | null;
}

export async function createFeedback(input: FeedbackInput): Promise<{ id: string }> {
  const screenshots = input.screenshots ?? [];

  const created = await prisma.feedback.create({
    data: {
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      pageUrl: input.pageUrl ?? null,
      userAgent: input.userAgent ?? null,
      userEmail: input.userEmail ?? null,
      screenshots: screenshots.length ? screenshots : undefined,
    },
    select: { id: true },
  });

  const id = created.id;
  const urls = feedbackScreenshotUrls(id, screenshots.length);
  const environment = env.NODE_ENV === "production" ? "Production" : "Development";

  // Fire the Notion sync after the response is sent. Failures are recorded on the
  // row (attempts + last error) so the reconciler can pick them up; they never
  // propagate to the user.
  after(async () => {
    try {
      const res = await syncFeedbackToNotion({
        id,
        type: input.type,
        title: input.title,
        description: input.description,
        pageUrl: input.pageUrl,
        userEmail: input.userEmail,
        userAgent: input.userAgent,
        screenshotUrls: urls,
        environment,
      });
      if (res) {
        await prisma.feedback.update({
          where: { id },
          data: { notionPageId: res.pageId, notionUrl: res.url, notionSyncedAt: new Date() },
        });
      } else {
        await prisma.feedback.update({
          where: { id },
          data: { notionSyncAttempts: { increment: 1 }, notionLastError: "sync returned null" },
        });
      }
    } catch (e) {
      console.error("[feedback] notion sync failed", e);
      await prisma.feedback
        .update({
          where: { id },
          data: { notionSyncAttempts: { increment: 1 }, notionLastError: String(e).slice(0, 500) },
        })
        .catch(() => {});
    }
  });

  return created;
}
