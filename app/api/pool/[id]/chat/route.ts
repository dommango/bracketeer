// GET  /api/pool/[id]/chat — recent messages (members only)
// POST /api/pool/[id]/chat — send a message (members only)

import { NextRequest } from "next/server";
import { z } from "zod";
import { getPoolAccess } from "@/lib/pool/access";
import { listMessages, postMessage } from "@/lib/pool/chat";
import { notifyPool } from "@/lib/realtime/notify";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const postSchema = z.object({ body: z.string().min(1, "Message is empty").max(2000) });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;
  const access = await getPoolAccess(poolId);
  if (!access) return apiError("Pool not found", 404);

  const limit = Number(req.nextUrl.searchParams.get("limit") || 50);
  const messages = await listMessages(poolId, Number.isFinite(limit) ? limit : 50);
  return apiOk({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;
  const access = await getPoolAccess(poolId);
  if (!access) return apiError("Pool not found", 404);

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
