// GET /api/feedback/screenshots/[id]/[index] — serve a stored feedback screenshot
// as a raster image. Public (no auth) so Notion's servers can fetch the external
// file URLs on a synced card. Screenshots are stored only as base64 data-URLs in
// Feedback.screenshots; this endpoint decodes one and streams the bytes. Security
// posture: strict raster mime allowlist (no SVG → no embedded script), nosniff,
// and a locked-down CSP so a served byte-stream can never execute.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Raster only — deliberately excludes image/svg+xml (SVG can carry script).
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_INDEX = 2;

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;

  const idx = Number(index);
  if (!Number.isInteger(idx) || idx < 0 || idx > MAX_INDEX) return notFound();

  const row = await prisma.feedback.findUnique({
    where: { id },
    select: { screenshots: true },
  });
  if (!row) return notFound();

  const shots = row.screenshots;
  if (!Array.isArray(shots)) return notFound();
  const dataUrl = shots[idx];
  if (typeof dataUrl !== "string") return notFound();

  const match = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return notFound();
  const [, mime, base64] = match;
  if (!ALLOWED_MIME.has(mime)) return notFound();

  let decoded: Buffer;
  try {
    decoded = Buffer.from(base64, "base64");
  } catch {
    return notFound();
  }
  if (decoded.length === 0) return notFound();
  // Copy into a concrete ArrayBuffer-backed view — Buffer's ArrayBufferLike
  // backing doesn't satisfy the DOM BodyInit type under TS's generic Uint8Array.
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  bytes.set(decoded);

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
