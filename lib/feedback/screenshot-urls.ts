// Public URLs to a feedback row's stored screenshots. Notion's servers fetch
// these directly when a synced card carries external file/image blocks. Shared by
// the submit path (after()) and the reconciler so both build identical URLs.

import { env } from "@/lib/env";

export function feedbackScreenshotUrls(id: string, count: number): string[] {
  const base = env.APP_BASE_URL.replace(/\/+$/, "");
  return Array.from({ length: count }, (_, i) => `${base}/api/feedback/screenshots/${id}/${i}`);
}
