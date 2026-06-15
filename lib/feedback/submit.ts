// Persist an in-app feedback submission, then best-effort mirror it to Notion.
// The DB write is the source of truth; the Notion sync is awaited (low volume)
// only to capture the back-link, and never fails the submission.

import { prisma } from "@/lib/db";
import type { FeedbackType } from "@/generated/prisma/enums";
import { syncFeedbackToNotion } from "@/lib/notion/feedback-sync";

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

  const notionUrl = await syncFeedbackToNotion({
    type: input.type,
    title: input.title,
    description: input.description,
    pageUrl: input.pageUrl,
    userEmail: input.userEmail,
    screenshotCount: screenshots.length,
  });
  if (notionUrl) {
    await prisma.feedback
      .update({ where: { id: created.id }, data: { notionUrl } })
      .catch(() => {});
  }

  return created;
}
