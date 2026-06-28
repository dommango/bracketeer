// POST /api/challenge/chat/react — toggle an emoji reaction in the global challenge chat

import { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/pool/access";
import { getTournamentIdBySlug } from "@/lib/pool/queries";
import { toggleChallengeReaction, canPostChallengeChat } from "@/lib/challenge/chat";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

// Same curated set as the pool chat reactions.
const ALLOWED_EMOJI = ["👍", "🔥", "😂", "😮", "😢", "⚽", "🎉", "💀"] as const;

const reactSchema = z.object({
  messageId: z.string().min(1),
  emoji: z.enum(ALLOWED_EMOJI),
});

const REACT_LIMIT = 40;
const REACT_WINDOW_MS = 30_000;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return apiError("Sign in to react.", 401);

  const tournamentId = await getTournamentIdBySlug();
  if (!(await canPostChallengeChat(user.id, tournamentId))) {
    return apiError("Enter a challenge to react.", 403);
  }

  const limited = await rateLimit(`react:challenge:${user.id}`, REACT_LIMIT, REACT_WINDOW_MS);
  if (!limited.ok) return apiError("Slow down a moment.", 429);

  let input: z.infer<typeof reactSchema>;
  try {
    input = reactSchema.parse(await req.json());
  } catch (err) {
    return apiError(`Invalid request: ${(err as Error).message}`, 400);
  }

  try {
    const active = await toggleChallengeReaction(tournamentId, input.messageId, user.id, input.emoji);
    return apiOk({ active });
  } catch (err) {
    return apiError((err as Error).message, 422);
  }
}
