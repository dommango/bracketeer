// Data export (GDPR access / portability). Gathers everything we hold about a
// user into one JSON-serializable object. Read-only. Screenshots (base64 blobs on
// Feedback) are omitted by size; everything else the user authored is included.

import { prisma } from "@/lib/db";

export async function exportUserData(userId: string) {
  const [user, memberships, entries, messages, feedback] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        emailVerified: true,
        termsAcceptedAt: true,
        ageConfirmedAt: true,
      },
    }),
    prisma.membership.findMany({
      where: { userId },
      select: {
        role: true,
        displayName: true,
        joinedAt: true,
        pool: { select: { name: true, joinCode: true } },
      },
    }),
    prisma.entry.findMany({
      where: { userId },
      select: {
        id: true,
        label: true,
        format: true,
        enteredChallenge: true,
        tiebreak: true,
        createdAt: true,
        picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
      },
    }),
    prisma.chatMessage.findMany({
      where: { userId },
      select: { body: true, attachmentUrl: true, createdAt: true },
    }),
    prisma.feedback.findMany({
      where: { userId },
      select: { type: true, title: true, description: true, pageUrl: true, createdAt: true },
    }),
  ]);

  return { exportedAt: new Date().toISOString(), user, memberships, entries, messages, feedback };
}
