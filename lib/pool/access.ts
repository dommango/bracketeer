// Authorization helpers used by route handlers and server components. All guards
// resolve the current user from the Auth.js session (database strategy) and look
// up the relevant membership. There is no middleware guard (see auth.ts).

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/env";
import type { MemberRole } from "@/generated/prisma/enums";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return { id: u.id, email: u.email ?? null, name: u.name ?? null };
}

export interface PoolAccess {
  user: SessionUser;
  poolId: string;
  role: MemberRole;
  isOwner: boolean;
}

// The current user's access to a pool, or null when unauthenticated, the pool is
// missing, or the user is not a member. The owner always has OWNER access even
// without an explicit Membership row.
export async function getPoolAccess(poolId: string): Promise<PoolAccess | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { id: true, ownerId: true },
  });
  if (!pool) return null;

  if (pool.ownerId === user.id) {
    return { user, poolId, role: "OWNER", isOwner: true };
  }

  const membership = await prisma.membership.findUnique({
    where: { poolId_userId: { poolId, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return null;

  return { user, poolId, role: membership.role, isOwner: false };
}

// Owners and pool admins may manage a pool (import picks, etc.).
export function canManagePool(access: PoolAccess | null): access is PoolAccess {
  return Boolean(access && (access.role === "OWNER" || access.role === "ADMIN"));
}

// Tournament admins (those allowed to enter official results) are gated by the
// ADMIN_EMAILS allow-list — see isAdminEmail for the open-dev fallback.
export async function getTournamentAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return isAdminEmail(user.email) ? user : null;
}
