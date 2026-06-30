// Pool lifecycle: create a pool, join one by code. These are the DB-touching
// counterparts to the pure helpers in join-code.ts. Used by the create/join
// server actions.

import { prisma } from "@/lib/db";
import { DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { arePicksLocked } from "@/lib/pool/lock";
import { generateJoinCode, normalizeJoinCode } from "@/lib/pool/join-code";
import { claimEntriesForUser } from "@/lib/auth/claim";
import { recomputePool } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { canAddMember, POOL_FULL_MESSAGE } from "@/lib/billing/entitlements";
import { logEvent } from "@/lib/analytics/events";

// A unique join code, retrying on the (rare) collision against the unique index.
async function allocateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    const taken = await prisma.pool.findUnique({ where: { joinCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique join code, please retry.");
}

export type PoolFormat = "FULL_BRACKET" | "KNOCKOUT" | "MATCH_DAY_3_PICKEM";

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
  const format = input.format ?? "FULL_BRACKET";

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { slug: input.tournamentSlug ?? DEFAULT_TOURNAMENT_SLUG },
    select: { id: true, startsAt: true },
  });

  // A full-tournament game's picks lock at the group kickoff — once that's past,
  // creating one is pointless (every pick would already be locked). Knockout
  // games are still creatable (they lock later, at the R32 kickoff). The create
  // UI hides the option too; this is the server-side backstop.
  if (format === "FULL_BRACKET" && arePicksLocked(tournament.startsAt)) {
    throw new Error(
      "The group stage has kicked off — Full Tournament Pools are closed. Create a Knockout Stage Pool instead.",
    );
  }

  // Match Day Pickem is a public challenge, not a pool — there's no private MD3
  // pool to create. Entries are made directly at /challenge/md3/play. The create
  // UI doesn't offer it; this is the server-side backstop.
  if (format === "MATCH_DAY_3_PICKEM") {
    throw new Error("Match Day Pickem is a challenge, not a pool — play it at /challenge/md3.");
  }

  const joinCode = await allocateJoinCode();

  const pool = await prisma.pool.create({
    data: {
      tournamentId: tournament.id,
      name,
      ownerId: input.userId,
      joinCode,
      format,
      memberships: {
        create: { userId: input.userId, role: "OWNER", displayName },
      },
    },
    select: { id: true, joinCode: true },
  });

  await logEvent({
    type: "POOL_CREATE",
    userId: input.userId,
    poolId: pool.id,
    tournamentId: tournament.id,
    metadata: { format },
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

  // Enforce the tier's member cap atomically. A per-pool advisory lock (same
  // pattern as recomputePool) serializes concurrent joins so the count→insert
  // can't overshoot the cap at the boundary. Only new members are capped — an
  // existing member re-joining is idempotent and never turned away, even at cap.
  let isNewMember = false;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pool.id}))`;
    const existing = await tx.membership.findUnique({
      where: { poolId_userId: { poolId: pool.id, userId: input.userId } },
      select: { id: true },
    });
    if (!existing) {
      isNewMember = true;
      const memberCount = await tx.membership.count({ where: { poolId: pool.id } });
      if (!canAddMember(pool.tier, memberCount)) throw new Error(POOL_FULL_MESSAGE);
    }
    await tx.membership.upsert({
      where: { poolId_userId: { poolId: pool.id, userId: input.userId } },
      update: {},
      create: { poolId: pool.id, userId: input.userId, role: "MEMBER", displayName },
    });
  });

  // Engagement: only a genuinely new membership counts as a join (a re-join is
  // idempotent and shouldn't inflate the metric). Best-effort.
  if (isNewMember) {
    await logEvent({ type: "POOL_JOIN", userId: input.userId, poolId: pool.id, metadata: { via: "code" } });
  }

  // Bind any imported entries matching this account's email (also enrolls the
  // user in their other pools — harmless and consistent with sign-in claiming).
  const claimed = await claimEntriesForUser(input.userId, user?.email);

  return { poolId: pool.id, joinCode: pool.joinCode, claimed };
}

export interface AttachEntryInput {
  userId: string;
  entryId: string;
  joinCode: string;
  displayName?: string;
}

export interface AttachedEntry {
  poolId: string;
  joinCode: string;
  poolName: string;
}

// Move one of the user's STANDALONE brackets into an existing pool, matched by
// join code (user story: "make a bracket, then match it to a pool"). The bracket
// keeps its picks and score; it just gains a pool. Guards: the bracket must be
// the user's and not already in a pool; the pool's game + tournament must match
// the bracket's (a knockout bracket only joins a knockout pool of the same
// tournament, so its picks stay valid against that pool's seed); and the pool's
// member cap is enforced just like joinPool. Enrolls the user as a Membership
// and recomputes the pool so the bracket lands on its leaderboard immediately.
export async function attachEntryToPool(input: AttachEntryInput): Promise<AttachedEntry> {
  const code = normalizeJoinCode(input.joinCode);
  if (!code) throw new Error("That doesn't look like a valid join code.");

  const pool = await prisma.pool.findUnique({
    where: { joinCode: code },
    select: { id: true, name: true, joinCode: true, tier: true, format: true, tournamentId: true },
  });
  if (!pool) throw new Error("No pool found for that join code.");

  const entry = await prisma.entry.findFirst({
    where: { id: input.entryId, userId: input.userId },
    select: { id: true, poolId: true, format: true, tournamentId: true },
  });
  if (!entry) throw new Error("That bracket can't be found or isn't yours.");
  if (entry.poolId) throw new Error("That bracket is already in a pool.");
  if (entry.tournamentId !== pool.tournamentId) {
    throw new Error("That pool is for a different tournament.");
  }
  if (entry.format !== pool.format) {
    const want =
      pool.format === "KNOCKOUT"
        ? "Knockout Stage"
        : pool.format === "MATCH_DAY_3_PICKEM"
          ? "Match Day Pickem"
          : "Full Tournament";
    throw new Error(`This is a ${want} pool — your bracket doesn't match its game.`);
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true },
  });
  const displayName = (input.displayName ?? "").trim() || user?.name?.trim() || "Player";

  // Enforce the member cap atomically inside the same transaction that attaches
  // the bracket, serialized by a per-pool advisory lock so concurrent attaches
  // can't overshoot the cap. Only a genuinely new member is capped.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pool.id}))`;
      const existingMembership = await tx.membership.findUnique({
        where: { poolId_userId: { poolId: pool.id, userId: input.userId } },
        select: { id: true },
      });
      if (!existingMembership) {
        const memberCount = await tx.membership.count({ where: { poolId: pool.id } });
        if (!canAddMember(pool.tier, memberCount)) throw new Error(POOL_FULL_MESSAGE);
      }
      await tx.entry.update({ where: { id: entry.id }, data: { poolId: pool.id } });
      await tx.membership.upsert({
        where: { poolId_userId: { poolId: pool.id, userId: input.userId } },
        update: {},
        create: { poolId: pool.id, userId: input.userId, role: "MEMBER", displayName },
      });
    });
  } catch (err) {
    // The (poolId, claimEmail, label) unique can trip if the user already has a
    // same-named bracket in that pool.
    if ((err as { code?: string }).code === "P2002") {
      throw new Error("You already have a bracket with that name in this pool.");
    }
    throw err;
  }

  // Land the bracket on the pool leaderboard right away (best-effort notify).
  await recomputePool(pool.id);
  await notifyPool(pool.id, "leaderboard");

  return { poolId: pool.id, joinCode: pool.joinCode, poolName: pool.name };
}
