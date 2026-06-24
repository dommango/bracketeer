// Permanent account deletion (GDPR erasure). Pools the user OWNS are deleted too:
// Pool.ownerId has no cascade and an owner-less pool is invalid, so we remove them
// first (which cascades that pool's memberships and SetNulls its entries' poolId).
// Most User back-references cascade (Account/Session/PushToken/Membership/
// MessageReaction), but Entry.user and Feedback.user are onDelete: SetNull — those
// rows survive the user delete, so we scrub their PII (email / real-name label)
// first to make deletion a true erasure while keeping anonymized brackets on pool
// leaderboards intact. All in one transaction so a partial failure can't leave a
// half-deleted account.

import { prisma } from "@/lib/db";

export interface AccountDeletionSummary {
  ownedPoolCount: number;
  // Unsent prize(s) the user has won — deletion is blocked while any exist so a
  // real-money award isn't orphaned before it's paid out.
  pendingPrizeCount: number;
}

export async function getAccountDeletionSummary(userId: string): Promise<AccountDeletionSummary> {
  const [ownedPoolCount, pendingPrizeCount] = await Promise.all([
    prisma.pool.count({ where: { ownerId: userId } }),
    prisma.prizeAward.count({ where: { userId, status: { in: ["PENDING", "REVIEW"] } } }),
  ]);
  return { ownedPoolCount, pendingPrizeCount };
}

export class AccountDeletionBlockedError extends Error {}

export async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Don't let an unpaid winner accidentally orphan their own prize claim.
    const pending = await tx.prizeAward.count({
      where: { userId, status: { in: ["PENDING", "REVIEW"] } },
    });
    if (pending > 0) {
      throw new AccountDeletionBlockedError(
        "You have a prize that hasn't been sent yet. Email dommango@gmail.com to sort the prize out before deleting your account.",
      );
    }

    // Scrub PII from rows that survive the user delete (SetNull relations).
    await tx.entry.updateMany({
      where: { userId },
      data: { claimEmail: null, label: "Former player" },
    });
    await tx.feedback.updateMany({
      where: { userId },
      data: { userEmail: null, userAgent: null },
    });

    // Owner-less pools are invalid (Pool.ownerId has no cascade) — delete them.
    const owned = await tx.pool.findMany({ where: { ownerId: userId }, select: { id: true } });
    for (const pool of owned) {
      await tx.pool.delete({ where: { id: pool.id } });
    }

    await tx.user.delete({ where: { id: userId } });
  });
}
