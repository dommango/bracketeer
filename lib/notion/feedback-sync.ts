// Best-effort mirror of an in-app feedback submission to a Notion board (the
// user's "Tasks & Workflows" database, Area = HessFest). SDK-free per project
// convention — a direct fetch to the Notion REST API. Fire-and-forget by design:
// any failure (no token, integration not shared with the DB, schema mismatch) is
// swallowed and returns null, so it can never break the submission that triggered
// it. Property names (Task/Area/Notes) target that board's schema specifically.

import { env, notionEnabled } from "@/lib/env";
import type { FeedbackType } from "@/generated/prisma/enums";

const NOTION_API = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28";
// Awaited in the request path (to capture the back-link), so keep it short — a
// slow/hung Notion must not noticeably delay the user's submit response.
const TIMEOUT_MS = 2_500;

const TYPE_LABEL: Record<FeedbackType, { emoji: string; word: string }> = {
  BUG: { emoji: "🐛", word: "Bug" },
  IDEA: { emoji: "💡", word: "Idea" },
  OTHER: { emoji: "💬", word: "Feedback" },
};

export interface NotionFeedbackInput {
  type: FeedbackType;
  title: string;
  description?: string | null;
  pageUrl?: string | null;
  userEmail?: string | null;
  screenshotCount: number;
}

// Returns the created Notion page URL on success, or null when disabled/failed.
// Never throws.
export async function syncFeedbackToNotion(
  input: NotionFeedbackInput,
): Promise<string | null> {
  if (!notionEnabled) return null;
  const label = TYPE_LABEL[input.type];

  const notes = [
    `${label.word} report`,
    input.pageUrl ? `Page: ${input.pageUrl}` : null,
    `From: ${input.userEmail ?? "anonymous"}`,
    input.screenshotCount > 0
      ? `${input.screenshotCount} screenshot(s) attached (view in app DB)`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 1900);

  const children = input.description
    ? [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: input.description.slice(0, 2000) } }],
          },
        },
      ]
    : [];

  try {
    const res = await fetch(NOTION_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: env.NOTION_FEEDBACK_DB_ID },
        icon: { type: "emoji", emoji: label.emoji },
        properties: {
          Task: { title: [{ text: { content: input.title.slice(0, 200) } }] },
          Area: { select: { name: "HessFest" } },
          Notes: { rich_text: [{ text: { content: notes } }] },
        },
        children,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // Surface the reason without breaking the submission: 404 = the integration
      // isn't connected to the DB, 401 = bad token, 400 = schema/property mismatch.
      const body = await res.text().catch(() => "");
      console.warn(`[feedback-sync] Notion ${res.status}: ${body.slice(0, 500)}`);
      return null;
    }
    const json = (await res.json()) as { url?: string };
    return json.url ?? null;
  } catch (err) {
    // Network error or the 2.5s timeout aborting the request.
    console.warn(`[feedback-sync] Notion request failed: ${String(err)}`);
    return null;
  }
}
