// GET  /api/challenge/chat — recent messages in the global challenge chat (public read)
// POST /api/challenge/chat — post a message (signed-in + entered in a challenge)

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import {
  listChallengeMessages,
  postChallengeMessage,
  canPostChallengeChat,
} from "@/lib/challenge/chat";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Mirrors the pool chat schema: https-only attachments, body optional when an
// attachment is present, and never both-empty.
const postSchema = z
  .object({
    body: z.string().max(2000).optional(),
    replyToId: z.string().optional(),
    attachmentUrl: z.string().url().max(2048).optional(),
    attachmentType: z.enum(["GIF", "IMAGE"]).optional(),
  })
  .refine((v) => !v.attachmentType || Boolean(v.attachmentUrl), {
    message: "attachmentType requires attachmentUrl",
    path: ["attachmentUrl"],
  })
  .refine(
    (v) => {
      if (!v.attachmentUrl) return true;
      try {
        return new URL(v.attachmentUrl).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "attachmentUrl must be https", path: ["attachmentUrl"] },
  )
  .refine((v) => Boolean(v.body?.trim()) || Boolean(v.attachmentUrl), {
    message: "Message is empty",
    path: ["body"],
  });

const CHAT_LIMIT = 20;
const CHAT_WINDOW_MS = 30_000;

export async function GET(req: NextRequest) {
  const tournamentId = await getTournamentIdBySlug();
  const user = await getSessionUser();

  const raw = Number(req.nextUrl.searchParams.get("limit") || 50);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 100) : 50;
  const messages = await listChallengeMessages(tournamentId, limit, user?.id ?? null);
  return apiOk({ messages });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return apiError("Sign in to chat.", 401);

  const tournamentId = await getTournamentIdBySlug();
  if (!(await canPostChallengeChat(user.id, tournamentId))) {
    return apiError("Enter a challenge to join the chat.", 403);
  }

  const limited = await rateLimit(`chat:challenge:${user.id}`, CHAT_LIMIT, CHAT_WINDOW_MS);
  if (!limited.ok) {
    return apiError("You're sending messages too fast — slow down a moment.", 429);
  }

  let input: z.infer<typeof postSchema>;
  try {
    input = postSchema.parse(await req.json());
  } catch (err) {
    return apiError(`Invalid body: ${(err as Error).message}`, 400);
  }

  try {
    const message = await postChallengeMessage(tournamentId, user.id, {
      body: input.body,
      replyToId: input.replyToId,
      attachmentUrl: input.attachmentUrl,
      attachmentType: input.attachmentType,
    });
    // No realtime notify: challenge pages already refresh on a 15s poll.
    return apiOk(message, { status: 201 });
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}
