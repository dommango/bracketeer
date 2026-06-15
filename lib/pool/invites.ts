// Pool invites: create a tokenized invite (optionally pre-addressed + expiring)
// and accept one (enroll a Membership, subject to the tier's member cap). The DB
// counterpart to the pure helpers in invite-token.ts; used by the manage and
// /invite server actions.

import { prisma } from "@/lib/db";
import { canAddMember, POOL_FULL_MESSAGE } from "@/lib/billing/entitlements";
import { claimEntriesForUser } from "@/lib/auth/claim";
import { generateInviteToken, isInviteValid } from "@/lib/pool/invite-token";

// Invites expire after two weeks by default — long enough to chase a friend,
// short enough that a leaked link doesn't live forever. Pass ttlMs: null to
// create a non-expiring invite.
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface CreateInviteInput {
  poolId: string;
  createdById: string;
  email?: string | null;
  ttlMs?: number | null;
}

export interface CreatedInvite {
  id: string;
  token: string;
}

export async function createInvite(input: CreateInviteInput): Promise<CreatedInvite> {
  const email = (input.email ?? "").trim().toLowerCase() || null;
  const expiresAt =
    input.ttlMs === null ? null : new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS));

  // Invitees always join as MEMBER (the schema default) — invites never carry an
  // elevated role, so an ADMIN can't mint OWNER/ADMIN access via a link.
  return prisma.poolInvite.create({
    data: {
      poolId: input.poolId,
      token: generateInviteToken(),
      email,
      createdById: input.createdById,
      expiresAt,
    },
    select: { id: true, token: true },
  });
}

export interface AcceptInviteResult {
  poolId: string;
  joinCode: string;
  claimed: number;
}

// Accept an invite by token for a signed-in user: validate it, enforce the
// member cap for genuinely new members, enroll the Membership, single-use stamp
// the invite, and claim any entries matching the user's email. Throws a
// user-facing message for invalid/expired/used invites or a full pool.
//
// The invite is a bearer link: a pre-addressed email is a delivery hint, not an
// access binding — anyone with the link can accept (same trust model as the
// shareable join code). The cap check, like joinPool's, isn't atomic with the
// insert (single-instance MVP assumption).
export async function acceptInvite(input: {
  token: string;
  userId: string;
  displayName?: string;
}): Promise<AcceptInviteResult> {
  const invite = await prisma.poolInvite.findUnique({
    where: { token: input.token },
    select: {
      id: true,
      poolId: true,
      role: true,
      acceptedAt: true,
      expiresAt: true,
      pool: { select: { joinCode: true, tier: true } },
    },
  });
  if (!invite) throw new Error("This invite link is invalid.");
  if (!isInviteValid(invite)) throw new Error("This invite has expired or already been used.");

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true },
  });

  const existing = await prisma.membership.findUnique({
    where: { poolId_userId: { poolId: invite.poolId, userId: input.userId } },
    select: { id: true },
  });
  if (!existing) {
    const memberCount = await prisma.membership.count({ where: { poolId: invite.poolId } });
    if (!canAddMember(invite.pool.tier, memberCount)) throw new Error(POOL_FULL_MESSAGE);
  }

  const displayName =
    (input.displayName ?? "").trim() || user?.name?.trim() || "Player";

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { poolId_userId: { poolId: invite.poolId, userId: input.userId } },
      update: {},
      create: { poolId: invite.poolId, userId: input.userId, role: invite.role, displayName },
    });
    await tx.poolInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedById: input.userId },
    });
  });

  const claimed = await claimEntriesForUser(input.userId, user?.email);
  return { poolId: invite.poolId, joinCode: invite.pool.joinCode, claimed };
}

export interface PendingInvite {
  id: string;
  token: string;
  email: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// Outstanding (unaccepted, unexpired) invites for a pool, newest first.
export async function listPendingInvites(poolId: string): Promise<PendingInvite[]> {
  const invites = await prisma.poolInvite.findMany({
    where: { poolId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, email: true, expiresAt: true, createdAt: true, acceptedAt: true },
  });
  return invites.filter((i) => isInviteValid(i));
}

// Revoke an invite. Scoped by poolId so a caller can't delete another pool's
// invite by guessing an id.
export async function revokeInvite(inviteId: string, poolId: string): Promise<void> {
  await prisma.poolInvite.deleteMany({ where: { id: inviteId, poolId } });
}
