// Pool chat. Messages belong to a pool; USER messages carry an author, SYSTEM
// messages (auto-posted match events) don't. Reads return the most recent N in
// chronological order, each with its reactions, quoted reply, and any attachment.
// Authorization (membership) is enforced by the route.

import { prisma } from "@/lib/db";
import type { ChatKind, AttachmentType } from "@/generated/prisma/enums";

const MAX_BODY = 2000;
// A short snippet of the parent shown inline on a reply.
const REPLY_EXCERPT = 120;

export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean; // the requesting viewer reacted with this emoji
}

export interface ReplyPreview {
  id: string;
  authorName: string | null; // null when replying to a SYSTEM message
  excerpt: string;
}

export interface ChatView {
  id: string;
  kind: ChatKind;
  body: string;
  userId: string | null;
  authorName: string | null; // null for SYSTEM messages
  createdAt: string;
  replyTo: ReplyPreview | null;
  attachmentUrl: string | null;
  attachmentType: AttachmentType | null;
  meta: Record<string, unknown> | null;
  reactions: ReactionGroup[];
}

export interface PostInput {
  body?: string;
  replyToId?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: AttachmentType | null;
}

function displayName(user: { name: string | null; email: string | null } | null): string | null {
  if (!user) return null;
  return user.name || user.email?.split("@")[0] || "Player";
}

function excerpt(body: string, url: string | null, type: AttachmentType | null): string {
  if (body.trim()) return body.trim().slice(0, REPLY_EXCERPT);
  if (type === "GIF") return "GIF";
  if (type === "IMAGE") return "Photo";
  return url ? "Attachment" : "";
}

type ReactionRow = { emoji: string; userId: string };

// Collapse raw reaction rows into per-emoji groups, flagging the viewer's own.
function groupReactions(rows: ReactionRow[], viewerId: string | null): ReactionGroup[] {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of rows) {
    const g = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    g.count += 1;
    if (viewerId && r.userId === viewerId) g.mine = true;
    byEmoji.set(r.emoji, g);
  }
  return [...byEmoji.entries()].map(([emoji, g]) => ({ emoji, count: g.count, mine: g.mine }));
}

const messageInclude = {
  user: { select: { name: true, email: true } },
  reactions: { select: { emoji: true, userId: true } },
  replyTo: {
    select: {
      id: true,
      body: true,
      attachmentUrl: true,
      attachmentType: true,
      user: { select: { name: true, email: true } },
    },
  },
} as const;

type MessageRow = {
  id: string;
  kind: ChatKind;
  body: string;
  userId: string | null;
  createdAt: Date;
  attachmentUrl: string | null;
  attachmentType: AttachmentType | null;
  meta: unknown;
  user: { name: string | null; email: string | null } | null;
  reactions: ReactionRow[];
  replyTo:
    | {
        id: string;
        body: string;
        attachmentUrl: string | null;
        attachmentType: AttachmentType | null;
        user: { name: string | null; email: string | null } | null;
      }
    | null;
};

function toView(m: MessageRow, viewerId: string | null): ChatView {
  return {
    id: m.id,
    kind: m.kind,
    body: m.body,
    userId: m.userId,
    authorName: displayName(m.user),
    createdAt: m.createdAt.toISOString(),
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorName: displayName(m.replyTo.user),
          excerpt: excerpt(m.replyTo.body, m.replyTo.attachmentUrl, m.replyTo.attachmentType),
        }
      : null,
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    meta: (m.meta as Record<string, unknown> | null) ?? null,
    reactions: groupReactions(m.reactions, viewerId),
  };
}

export async function listMessages(
  poolId: string,
  limit = 50,
  viewerId: string | null = null,
): Promise<ChatView[]> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await prisma.chatMessage.findMany({
    where: { poolId },
    orderBy: { createdAt: "desc" },
    take,
    include: messageInclude,
  });
  return rows.reverse().map((m) => toView(m as MessageRow, viewerId));
}

export async function postMessage(
  poolId: string,
  userId: string,
  input: PostInput,
): Promise<ChatView> {
  const body = (input.body ?? "").trim();
  const hasAttachment = Boolean(input.attachmentUrl);
  if (!body && !hasAttachment) throw new Error("Message is empty");
  if (body.length > MAX_BODY) throw new Error(`Message exceeds ${MAX_BODY} characters`);

  // A reply target must belong to the same pool (prevents cross-pool quoting).
  let replyToId: string | null = null;
  if (input.replyToId) {
    const parent = await prisma.chatMessage.findFirst({
      where: { id: input.replyToId, poolId },
      select: { id: true },
    });
    if (!parent) throw new Error("Reply target not found");
    replyToId = parent.id;
  }

  const m = await prisma.chatMessage.create({
    data: {
      poolId,
      userId,
      kind: "USER",
      body,
      replyToId,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentType: input.attachmentType ?? null,
    },
    include: messageInclude,
  });
  return toView(m as MessageRow, userId);
}

// Auto-posted match event (goal, card, result). No author; `meta` carries the
// match number + event kind so the client can render a styled, linkable card.
export async function postSystemMessage(
  poolId: string,
  body: string,
  meta: Record<string, unknown>,
): Promise<ChatView> {
  const m = await prisma.chatMessage.create({
    data: { poolId, userId: null, kind: "SYSTEM", body, meta: meta as object },
    include: messageInclude,
  });
  return toView(m as MessageRow, null);
}

// Toggle one (message, viewer, emoji) reaction. Returns true if it now exists.
// Verifies the message is in `poolId` so a member can't react across pools.
export async function toggleReaction(
  poolId: string,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<boolean> {
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, poolId },
    select: { id: true },
  });
  if (!message) throw new Error("Message not found");

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
    select: { id: true },
  });
  if (existing) {
    // deleteMany is a no-op if a concurrent toggle already removed it (no throw).
    await prisma.messageReaction.deleteMany({ where: { messageId, userId, emoji } });
    return false;
  }
  try {
    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
    return true;
  } catch (err) {
    // A concurrent request already inserted the same (message,user,emoji): the
    // unique constraint makes the toggle idempotent rather than a 422.
    if ((err as { code?: string }).code === "P2002") return true;
    throw err;
  }
}
