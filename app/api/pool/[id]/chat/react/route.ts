// POST /api/pool/[id]/chat/react — toggle an emoji reaction on a message (members only)

import { NextRequest } from "next/server";
import { z } from "zod";
import { getPoolAccess } from "@/lib/pool/access";
import { toggleReaction } from "@/lib/pool/chat";
import { notifyPool } from "@/lib/realtime/notify";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

// A small curated set keeps reactions tidy and the column free of arbitrary input.
const ALLOWED_EMOJI = ["👍", "🔥", "😂", "😮", "😢", "⚽", "🎉", "💀"] as const;

const reactSchema = z.object({
  messageId: z.string().min(1),
  emoji: z.enum(ALLOWED_EMOJI),
});

const REACT_LIMIT = 40;
const REACT_WINDOW_MS = 30_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;
  const access = await getPoolAccess(poolId);
  if (!access) return apiError("Pool not found", 404);

  const limited = await rateLimit(`react:${access.user.id}`, REACT_LIMIT, REACT_WINDOW_MS);
  if (!limited.ok) return apiError("Slow down a moment.", 429);

  let input: z.infer<typeof reactSchema>;
  try {
    input = reactSchema.parse(await req.json());
  } catch (err) {
    return apiError(`Invalid request: ${(err as Error).message}`, 400);
  }

  try {
    const active = await toggleReaction(poolId, input.messageId, access.user.id, input.emoji);
    await notifyPool(poolId, "chat");
    return apiOk({ active });
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}
