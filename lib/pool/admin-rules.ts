// Pure governance rules for pool management. Kept free of Prisma so the policy
// (what a manager may assign, what may never be touched) is unit-testable and
// shared by the DB service and the server actions.

import type { MemberRole } from "@/generated/prisma/enums";

const MAX_POOL_NAME = 80;

export function normalizePoolName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new Error("Pool name is required.");
  return name.slice(0, MAX_POOL_NAME);
}

// Roles a manager may assign. OWNER is deliberately excluded: ownership transfer
// is out of scope, and excluding it stops an admin from minting a second owner
// or demoting the real one.
const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function parseAssignableRole(raw: string): AssignableRole {
  if ((ASSIGNABLE_ROLES as readonly string[]).includes(raw)) {
    return raw as AssignableRole;
  }
  throw new Error(`Invalid role: ${raw}`);
}

// Whether a membership row is the protected pool owner — by role AND by identity.
// The identity check matters because ownership lives on Pool.ownerId: guarding on
// the role string alone would miss an owner whose membership row was ever written
// with a non-OWNER role. Used by the management service to refuse owner mutations.
export function isProtectedOwner(
  targetRole: MemberRole,
  targetUserId: string,
  poolOwnerId: string,
): boolean {
  return targetRole === "OWNER" || targetUserId === poolOwnerId;
}
