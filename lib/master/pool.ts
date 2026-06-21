// The master tournament pool: a single, system-owned pool per
// tournament+format that aggregates every solo bracket. Solo entries live here
// (created without a Membership); opting in flips Entry.enteredMaster so the
// bracket surfaces on the public master leaderboard. Ordinary friend-group
// pools are unaffected — they're never isMaster.

import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { PoolFormat } from "@/lib/pool/manage";
import { generateJoinCode } from "@/lib/pool/join-code";

// A fixed account that owns the master pools. Pool.ownerId is required, but the
// master pool has no human owner — this placeholder satisfies the FK without
// granting anyone owner powers (the solo flow never reads pool ownership).
const SYSTEM_USER_EMAIL = "system@bracketeer.local";
const SYSTEM_USER_NAME = "Bracketeer";

async function getOrCreateSystemUser(tx: Prisma.TransactionClient): Promise<string> {
  const user = await tx.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: { email: SYSTEM_USER_EMAIL, name: SYSTEM_USER_NAME },
    select: { id: true },
  });
  return user.id;
}

async function allocateJoinCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    const taken = await tx.pool.findUnique({ where: { joinCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique join code for the master pool, please retry.");
}

// The id of the master pool for a tournament+format, creating it on first use.
// Idempotent under concurrency: a per-(tournament,format) advisory lock
// serializes the find-or-create so two simultaneous first submissions can't
// create two master pools. The pool is PREMIUM (uncapped — it holds every solo
// entry) and carries no Membership rows (solo players aren't pool members).
export async function getOrCreateMasterPool(
  tournamentId: string,
  format: PoolFormat = "KNOCKOUT",
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`master:${tournamentId}:${format}`}))`;

    const existing = await tx.pool.findFirst({
      where: { tournamentId, format, isMaster: true },
      select: { id: true },
    });
    if (existing) return existing.id;

    const ownerId = await getOrCreateSystemUser(tx);
    const joinCode = await allocateJoinCode(tx);
    const pool = await tx.pool.create({
      data: {
        tournamentId,
        name: format === "KNOCKOUT" ? "Master Knockout Tournament" : "Master Tournament",
        ownerId,
        joinCode,
        format,
        tier: "PREMIUM",
        isMaster: true,
      },
      select: { id: true },
    });
    return pool.id;
  });
}
