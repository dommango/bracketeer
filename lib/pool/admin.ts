// DB-touching pool-management operations, used by the manage server actions.
// Every mutation is scoped to the pool id (and protects the OWNER row), so a
// forged membership/entry id can't reach across pools or touch the owner.

import { prisma } from "@/lib/db";
import type { MemberRole } from "@/generated/prisma/enums";
import { normalizePoolName, isProtectedOwner, type AssignableRole } from "./admin-rules";

export interface PoolMember {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: MemberRole;
  joinedAt: Date;
  isOwner: boolean;
}

export async function listPoolMembers(poolId: string): Promise<PoolMember[]> {
  const rows = await prisma.membership.findMany({
    where: { poolId },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      id: true,
      userId: true,
      displayName: true,
      role: true,
      joinedAt: true,
      user: { select: { email: true } },
    },
  });
  return rows.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    displayName: m.displayName,
    email: m.user.email,
    role: m.role,
    joinedAt: m.joinedAt,
    isOwner: m.role === "OWNER",
  }));
}

// Change a member's role. Pool-scoped (a forged id from another pool matches
// nothing) and a no-op on the protected owner — by role and by identity, since
// ownership lives on Pool.ownerId.
export async function setMemberRole(
  poolId: string,
  membershipId: string,
  role: AssignableRole,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.membership.findFirst({
      where: { id: membershipId, poolId },
      select: { id: true, role: true, userId: true },
    });
    if (!target) return;
    const pool = await tx.pool.findUnique({ where: { id: poolId }, select: { ownerId: true } });
    if (!pool || isProtectedOwner(target.role, target.userId, pool.ownerId)) return;
    await tx.membership.update({ where: { id: target.id }, data: { role } });
  });
}

// Remove a member from the pool. Protects the owner (by role and identity) and
// unclaims any entry the member had in this pool — the bracket stays in the pool,
// scored and re-claimable, but no longer bound to a non-member account.
export async function removeMember(poolId: string, membershipId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.membership.findFirst({
      where: { id: membershipId, poolId },
      select: { id: true, role: true, userId: true },
    });
    if (!target) return;
    const pool = await tx.pool.findUnique({ where: { id: poolId }, select: { ownerId: true } });
    if (!pool || isProtectedOwner(target.role, target.userId, pool.ownerId)) return;
    await tx.entry.updateMany({
      where: { poolId, userId: target.userId },
      data: { userId: null },
    });
    await tx.membership.delete({ where: { id: target.id } });
  });
}

export async function renamePool(poolId: string, rawName: string): Promise<void> {
  const name = normalizePoolName(rawName);
  await prisma.pool.update({ where: { id: poolId }, data: { name } });
}

// Delete a pool and everything under it (memberships, entries, picks, messages,
// snapshots) via the schema's onDelete: Cascade relations.
export async function deletePool(poolId: string): Promise<void> {
  await prisma.pool.delete({ where: { id: poolId } });
}

export interface PoolEntry {
  entryId: string;
  label: string;
  locked: boolean;
  claimEmail: string | null;
  claimed: boolean;
  importedFrom: string;
  totalPoints: number;
  pickCount: number;
}

export async function listPoolEntries(poolId: string): Promise<PoolEntry[]> {
  const rows = await prisma.entry.findMany({
    where: { poolId },
    orderBy: { label: "asc" },
    select: {
      id: true,
      label: true,
      locked: true,
      claimEmail: true,
      userId: true,
      importedFrom: true,
      breakdown: { select: { totalPoints: true } },
      _count: { select: { picks: true } },
    },
  });
  return rows.map((e) => ({
    entryId: e.id,
    label: e.label,
    locked: e.locked,
    claimEmail: e.claimEmail,
    claimed: e.userId != null,
    importedFrom: e.importedFrom,
    totalPoints: e.breakdown?.totalPoints ?? 0,
    pickCount: e._count.picks,
  }));
}

export async function setEntryLocked(
  poolId: string,
  entryId: string,
  locked: boolean,
): Promise<void> {
  await prisma.entry.updateMany({ where: { id: entryId, poolId }, data: { locked } });
}

// Remove an entry (and its picks/breakdown/snapshots via Cascade). The caller is
// responsible for recomputing the pool afterwards, since ranks shift.
export async function removeEntry(poolId: string, entryId: string): Promise<void> {
  await prisma.entry.deleteMany({ where: { id: entryId, poolId } });
}
