// GET  /api/pool/[id]/chat — recent messages (members only)
// POST /api/pool/[id]/chat — send a message (members only)

import { NextRequest } from "next/server";
import { z } from "zod";
import { getPoolAccess } from "@/lib/pool/access";
import { listMessages, postMessage } from "@/lib/pool/chat";
import { notifyPool } from "@/lib/realtime/notify";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const postSchema = z.object({ body: z.string().min(1, "Message is empty").max(2000) });

// Per-sender cap so one member can't flood the pool chat.
const CHAT_LIMIT = 20;
const CHAT_WINDOW_MS = 30_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;
  const access = await getPoolAccess(poolId);
  if (!access) return apiError("Pool not found", 404);

  const raw = Number(req.nextUrl.searchParams.get("limit") || 50);
  // Clamp so a caller can't request an unbounded page.
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 100) : 50;
  const messages = await listMessages(poolId, limit);
  return apiOk({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;
  const access = await getPoolAccess(poolId);
  if (!access) return apiError("Pool not found", 404);

  const limited = rateLimit(`chat:${access.user.id}`, CHAT_LIMIT, CHAT_WINDOW_MS);
  if (!limited.ok) {
    return apiError("You're sending messages too fast — slow down a moment.", 429);
  }

  let body: string;
  try {
    body = postSchema.parse(await req.json()).body;
  } catch (err) {
    return apiError(`Invalid body: ${(err as Error).message}`, 400);
  }

  try {
    const message = await postMessage(poolId, access.user.id, body);
    await notifyPool(poolId, "chat");
    return apiOk(message, { status: 201 });
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}
