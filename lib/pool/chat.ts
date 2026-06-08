// Pool chat. Messages belong to a pool and a user; reads return the most recent
// N in chronological order. Authorization (membership) is enforced by the route.

import { prisma } from "@/lib/db";

export interface ChatView {
  id: string;
  body: string;
  userId: string;
  authorName: string;
  createdAt: string;
}

const MAX_BODY = 2000;

function displayName(user: { name: string | null; email: string | null }): string {
  return user.name || user.email?.split("@")[0] || "Player";
}

export async function listMessages(poolId: string, limit = 50): Promise<ChatView[]> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await prisma.chatMessage.findMany({
    where: { poolId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true, email: true } } },
  });
  return rows
    .reverse()
    .map((m) => ({
      id: m.id,
      body: m.body,
      userId: m.userId,
      authorName: displayName(m.user),
      createdAt: m.createdAt.toISOString(),
    }));
}

export async function postMessage(
  poolId: string,
  userId: string,
  body: string,
): Promise<ChatView> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message is empty");
  if (trimmed.length > MAX_BODY) throw new Error(`Message exceeds ${MAX_BODY} characters`);

  const m = await prisma.chatMessage.create({
    data: { poolId, userId, body: trimmed },
    include: { user: { select: { name: true, email: true } } },
  });
  return {
    id: m.id,
    body: m.body,
    userId: m.userId,
    authorName: displayName(m.user),
    createdAt: m.createdAt.toISOString(),
  };
}
