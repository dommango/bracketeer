// Pool lifecycle: create a pool, join one by code. These are the DB-touching
// counterparts to the pure helpers in join-code.ts. Used by the create/join
// server actions.

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { generateJoinCode, normalizeJoinCode } from "@/lib/pool/join-code";
import { claimEntriesForUser } from "@/lib/auth/claim";
import { canAddMember, POOL_FULL_MESSAGE } from "@/lib/billing/entitlements";

// A unique join code, retrying on the (rare) collision against the unique index.
async function allocateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    const taken = await prisma.pool.findUnique({ where: { joinCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique join code, please retry.");
}

export type PoolFormat = "FULL_BRACKET" | "KNOCKOUT";

export interface CreatePoolInput {
  userId: string;
  name: string;
  displayName: string;
  tournamentSlug?: string;
  // The game the pool plays. Defaults to the classic full-bracket pool.
  format?: PoolFormat;
}

export interface CreatedPool {
  id: string;
  joinCode: string;
}

// Create a pool owned by the user, with the owner enrolled as a Membership
// (OWNER) so they appear in member-gated views immediately.
export async function createPool(input: CreatePoolInput): Promise<CreatedPool> {
  const name = input.name.trim();
  if (!name) throw new Error("Pool name is required.");
  const displayName = input.displayName.trim() || "Owner";

  const tournamentId = await getTournamentIdBySlug(
    input.tournamentSlug ?? DEFAULT_TOURNAMENT_SLUG,
  );
  const joinCode = await allocateJoinCode();

  const pool = await prisma.pool.create({
    data: {
      tournamentId,
      name,
      ownerId: input.userId,
      joinCode,
      format: input.format ?? "FULL_BRACKET",
      memberships: {
        create: { userId: input.userId, role: "OWNER", displayName },
      },
    },
    select: { id: true, joinCode: true },
  });

  return pool;
}

export interface JoinPoolInput {
  userId: string;
  joinCode: string;
  displayName?: string;
}

export interface JoinedPool {
  poolId: string;
  joinCode: string;
  claimed: number;
}

// Join a pool by code: enroll a Membership (idempotent) and claim any imported
// entries that match the user's email. Returns the pool + how many entries were
// bound to the account.
export async function joinPool(input: JoinPoolInput): Promise<JoinedPool> {
  const code = normalizeJoinCode(input.joinCode);
  if (!code) throw new Error("That doesn't look like a valid join code.");

  const pool = await prisma.pool.findUnique({
    where: { joinCode: code },
    select: { id: true, joinCode: true, tier: true },
  });
  if (!pool) throw new Error("No pool found for that join code.");

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true },
  });

  const displayName =
    (input.displayName ?? "").trim() || user?.name?.trim() || "Player";

  // Enforce the tier's member cap, but only for genuinely new members — an
  // existing member re-joining (idempotent) must never be turned away even at cap.
  // The count→insert isn't atomic: two simultaneous joins at the cap boundary
  // could both pass. Acceptable for the single-instance MVP (same assumption the
  // in-process rate limiter makes); a scaled deploy would enforce this in a
  // serializable transaction or a DB constraint.
  const existing = await prisma.membership.findUnique({
    where: { poolId_userId: { poolId: pool.id, userId: input.userId } },
    select: { id: true },
  });
  if (!existing) {
    const memberCount = await prisma.membership.count({ where: { poolId: pool.id } });
    if (!canAddMember(pool.tier, memberCount)) throw new Error(POOL_FULL_MESSAGE);
  }

  await prisma.membership.upsert({
    where: { poolId_userId: { poolId: pool.id, userId: input.userId } },
    update: {},
    create: { poolId: pool.id, userId: input.userId, role: "MEMBER", displayName },
  });

  // Bind any imported entries matching this account's email (also enrolls the
  // user in their other pools — harmless and consistent with sign-in claiming).
  const claimed = await claimEntriesForUser(input.userId, user?.email);

  return { poolId: pool.id, joinCode: pool.joinCode, claimed };
}
