// Entry claiming. Imported entries start with userId=null and a claimEmail taken
// from the contestant's CSV row. When that person signs in, we bind every
// matching unclaimed entry to their account — and, for each pool that still has
// room under its tier's member cap, give them a Membership so they can fully
// participate (chat, see themselves on the board) — without ever overwriting an
// entry already claimed by someone else.
//
// The entry is always bound (so it appears on the public leaderboard); the
// Membership is cap-gated. A claimer for a FREE pool already at FREE_MEMBER_CAP
// keeps their bound entry but gets no Membership until the owner upgrades to
// Premium — mirroring the cap that joinPool/acceptInvite enforce, so the claim
// path (CSV import + sign-in) can't be used to bypass the gate. The return value
// counts entries claimed, not memberships seated.

import { prisma } from "@/lib/db";
import { canAddMember } from "@/lib/billing/entitlements";

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

      // An existing member keeps their membership untouched (idempotent re-claim).
      const existing = await tx.membership.findUnique({
        where: { poolId_userId: { poolId: entry.poolId, userId } },
        select: { id: true },
      });
      if (existing) continue;

      // Enforce the pool's tier cap for genuinely new members — otherwise the
      // claim path (CSV import + sign-in, the primary way contestants enroll)
      // would silently push a FREE pool past its member cap, bypassing the gate
      // that joinPool/acceptInvite enforce. At cap, the entry is still bound to
      // the account above; the owner upgrades to Premium to seat them. The
      // count→create isn't atomic (same documented MVP tradeoff as joinPool).
      const pool = await tx.pool.findUnique({
        where: { id: entry.poolId },
        select: { tier: true },
      });
      if (!pool) continue;
      const memberCount = await tx.membership.count({ where: { poolId: entry.poolId } });
      if (!canAddMember(pool.tier, memberCount)) continue;

      await tx.membership.create({
        data: {
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
