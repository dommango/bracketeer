// POST /api/feedback — submit an in-app bug report / idea. Open to anyone (the
// floating widget renders app-wide); a signed-in user is attributed, anonymous
// submissions are kept too. Rate-limited per user, else per source IP.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/pool/access";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk, apiError } from "@/lib/api";
import { createFeedback } from "@/lib/feedback/submit";

export const dynamic = "force-dynamic";

// Each screenshot is a base64 data URL (region snip, JPEG ~0.6). Constrain the
// exact subtype + base64 shape (no SVG, no arbitrary trailing content) and cap
// per-item size; the array also has a combined-size ceiling below.
const dataUrl = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
  .max(1_500_000);

const MAX_SCREENSHOTS_BYTES = 3_000_000;

const schema = z.object({
  type: z.enum(["BUG", "IDEA", "OTHER"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000).optional(),
  // window.location.href on the client; restrict to http(s) so a stored value
  // can never be a javascript:/data: URL if ever rendered as a link in admin.
  pageUrl: z
    .string()
    .max(2048)
    .regex(/^https?:\/\//i, "must be an http(s) URL")
    .optional(),
  userAgent: z.string().max(1024).optional(),
  screenshots: z
    .array(dataUrl)
    .max(3)
    .refine(
      (a) => a.reduce((n, s) => n + s.length, 0) <= MAX_SCREENSHOTS_BYTES,
      "screenshots exceed the combined size limit",
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const key = user ? `feedback:${user.id}` : `feedback:ip:${ip}`;
  const rl = await rateLimit(key, 10, 5 * 60_000);
  if (!rl.ok) return apiError("rate limited", 429);

  let parsed;
  try {
    parsed = schema.parse(await req.json());
  } catch {
    return apiError("invalid body", 400);
  }

  const { id } = await createFeedback({
    ...parsed,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
  });
  return apiOk({ id });
}
