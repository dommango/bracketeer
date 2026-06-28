// Global challenge chat: one shared thread per tournament, for everyone entered in
// an active public challenge (Knockout / Match Day Pickem). Mirrors lib/pool/chat.ts
// but scoped by tournamentId instead of poolId, reusing the same message decoding,
// reactions, replies, and attachments so the UI is identical to pool chat. Reads are
// public; the posting gate (canPostChallengeChat) is enforced by the route.

import { prisma } from "@/lib/db";
import {
  messageInclude,
  toChatView,
  type MessageRow,
  type ChatView,
  type PostInput,
} from "@/lib/pool/chat";

const MAX_BODY = 2000;

// Whether a user may post in the global challenge chat: they must have entered at
// least one of their brackets in a public challenge for this tournament. Reading is
// open to everyone; only posting is gated.
export async function canPostChallengeChat(
  userId: string,
  tournamentId: string,
): Promise<boolean> {
  const entry = await prisma.entry.findFirst({
    where: {
      userId,
      tournamentId,
      enteredChallenge: true,
      format: { in: ["KNOCKOUT", "MATCH_DAY_3_PICKEM"] },
    },
    select: { id: true },
  });
  return Boolean(entry);
}

export async function listChallengeMessages(
  tournamentId: string,
  limit = 50,
  viewerId: string | null = null,
): Promise<ChatView[]> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await prisma.chatMessage.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "desc" },
    take,
    include: messageInclude,
  });
  return rows.reverse().map((m) => toChatView(m as MessageRow, viewerId));
}

export async function postChallengeMessage(
  tournamentId: string,
  userId: string,
  input: PostInput,
): Promise<ChatView> {
  const body = (input.body ?? "").trim();
  const hasAttachment = Boolean(input.attachmentUrl);
  if (!body && !hasAttachment) throw new Error("Message is empty");
  if (body.length > MAX_BODY) throw new Error(`Message exceeds ${MAX_BODY} characters`);

  // A reply target must belong to the same tournament chat (no cross-scope quoting).
  let replyToId: string | null = null;
  if (input.replyToId) {
    const parent = await prisma.chatMessage.findFirst({
      where: { id: input.replyToId, tournamentId },
      select: { id: true },
    });
    if (!parent) throw new Error("Reply target not found");
    replyToId = parent.id;
  }

  const m = await prisma.chatMessage.create({
    data: {
      tournamentId,
      userId,
      kind: "USER",
      body,
      replyToId,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentType: input.attachmentType ?? null,
    },
    include: messageInclude,
  });
  return toChatView(m as MessageRow, userId);
}

// Auto-posted challenge match event (goal, card, result), no author. Unused in the
// chat v1 UI but mirrors the pool's system-message path for a future match feed.
export async function postChallengeSystemMessage(
  tournamentId: string,
  body: string,
  meta: Record<string, unknown>,
): Promise<ChatView> {
  const m = await prisma.chatMessage.create({
    data: { tournamentId, userId: null, kind: "SYSTEM", body, meta: meta as object },
    include: messageInclude,
  });
  return toChatView(m as MessageRow, null);
}

// Toggle one (message, viewer, emoji) reaction in the challenge chat. Verifies the
// message belongs to this tournament so a reaction can't cross scopes.
export async function toggleChallengeReaction(
  tournamentId: string,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, tournamentId },
    select: { id: true },
  });
  if (!message) throw new Error("Message not found");

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
    select: { id: true },
  });
  if (existing) {
    await prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
    return false;
  }
  try {
    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return true;
    throw err;
  }
}
