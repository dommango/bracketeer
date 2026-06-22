// Entry claiming. Imported entries start with userId=null and a claimEmail taken
// from the contestant's CSV row. When that person signs in, we bind every
// matching unclaimed entry to their account — and give them a Membership in each
// of those pools so they can participate (chat, see themselves on the board) —
// without ever overwriting an entry already claimed by someone else.

import { prisma } from "@/lib/db";

export async function claimEntriesForUser(
  userId: string,
  email: string | null | undefined,
): Promise<number> {
  const normalized = (email || "").trim().toLowerCase();
  if (!userId || !normalized) return 0;

  const entries = await prisma.entry.findMany({
    where: { claimEmail: normalized, userId: null },
    select: { id: true, poolId: true, label: true },
  });
  if (entries.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    await tx.entry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { userId },
    });

    // Enroll the user in each pool an entry belongs to. Standalone brackets
    // (poolId null) have no pool to join, so they're claimed without a Membership.
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!entry.poolId || seen.has(entry.poolId)) continue;
      seen.add(entry.poolId);
      await tx.membership.upsert({
        where: { poolId_userId: { poolId: entry.poolId, userId } },
        update: {},
        create: {
          poolId: entry.poolId,
          userId,
          role: "MEMBER",
          displayName: entry.label || "Player",
        },
      });
    }
  });

  return entries.length;
}
