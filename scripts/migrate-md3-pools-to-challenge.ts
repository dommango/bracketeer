// Migrate Match Day 3 Pickem pools into the public challenge.
//
// MD3 is now challenge-only — there are no MD3 *pools* any more (see lib/pool/
// games.ts, app/pool/create). This one-shot migration converts every existing MD3
// pool entry into a poolless standalone challenge entry (poolId = null,
// enteredChallenge = true — under the challenge-only model, having predictions IS
// being in the challenge), then deletes the now-empty MD3 pools. Deleting a pool
// cascades its memberships / invites / chat / leaderboard snapshots; Entry.poolId
// is onDelete:SetNull, so any entry still attached at delete time would silently
// become an orphan standalone entry — that's exactly why duplicates and orphans
// are removed FIRST.
//
// Policy (the two decisions that matter on real data):
//   1. ONE entry per user. A user can only hold a single challenge entry, but can
//      sit in several MD3 pools. We keep their most-recently-created entry (their
//      latest full set of predictions) and drop the older duplicates.
//   2. Unclaimed entries (no owning user) can't play an account-gated challenge,
//      so they're dropped rather than orphaned.
//
// DRY RUN by default: prints the plan and writes nothing. Pass --commit to apply,
// wrapped in a single transaction so a partial failure rolls back cleanly.
//
//   env $ENV npx tsx scripts/migrate-md3-pools-to-challenge.ts            # dry run
//   env $ENV npx tsx scripts/migrate-md3-pools-to-challenge.ts --commit   # apply

import { prisma } from "@/lib/db";
import { scoreStandaloneMd3 } from "@/lib/pool/md3-scoring";

const COMMIT = process.argv.includes("--commit");

interface EntryRow {
  id: string;
  userId: string | null;
  tournamentId: string;
  label: string;
  createdAt: Date;
  picks: number;
}

async function main() {
  const pools = await prisma.pool.findMany({
    where: { format: "MATCH_DAY_3_PICKEM" },
    select: { id: true, name: true, joinCode: true, tournamentId: true },
  });

  if (pools.length === 0) {
    console.log("No MD3 pools found — nothing to migrate.");
    await prisma.$disconnect();
    return;
  }

  const poolIds = pools.map((p) => p.id);
  const rawEntries = await prisma.entry.findMany({
    where: { poolId: { in: poolIds }, format: "MATCH_DAY_3_PICKEM" },
    select: {
      id: true,
      userId: true,
      tournamentId: true,
      label: true,
      createdAt: true,
      _count: { select: { picks: true } },
    },
  });
  const entries: EntryRow[] = rawEntries.map((e) => ({
    id: e.id,
    userId: e.userId,
    tournamentId: e.tournamentId,
    label: e.label,
    createdAt: e.createdAt,
    picks: e._count.picks,
  }));

  // Partition: unclaimed (no user) → drop; otherwise group per (tournament, user)
  // and keep the newest, dropping the rest as duplicates.
  const orphanIds: string[] = [];
  const byUser = new Map<string, EntryRow[]>();
  for (const e of entries) {
    if (!e.userId) {
      orphanIds.push(e.id);
      continue;
    }
    const key = `${e.tournamentId}::${e.userId}`;
    (byUser.get(key) ?? byUser.set(key, []).get(key)!).push(e);
  }

  const keepIds: string[] = [];
  const duplicateIds: string[] = [];
  for (const group of byUser.values()) {
    const sorted = [...group].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    keepIds.push(sorted[0].id);
    duplicateIds.push(...sorted.slice(1).map((e) => e.id));
  }

  const tournamentIds = [...new Set(pools.map((p) => p.tournamentId))];

  console.log(`=== MD3 pool → challenge migration ${COMMIT ? "(COMMIT)" : "(dry run)"} ===\n`);
  console.log(`Pools to delete: ${pools.length}`);
  for (const p of pools) console.log(`  · ${p.name} [${p.joinCode}]`);
  console.log(`\nMD3 pool entries: ${entries.length}`);
  console.log(`  keep  → standalone challenge entries: ${keepIds.length}`);
  console.log(`  drop  → duplicate (user already kept):  ${duplicateIds.length}`);
  console.log(`  drop  → unclaimed (no owning user):     ${orphanIds.length}`);
  console.log(`\nTournaments to rescore: ${tournamentIds.length}`);

  if (!COMMIT) {
    console.log("\nDry run — no changes written. Re-run with --commit to apply.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const toDelete = [...duplicateIds, ...orphanIds];
    if (toDelete.length > 0) {
      await tx.entry.deleteMany({ where: { id: { in: toDelete } } }); // picks/scores cascade
    }
    // Detach survivors and mark them entered BEFORE deleting the pools, so the
    // SetNull-on-pool-delete never turns a to-be-dropped entry into an orphan.
    await tx.entry.updateMany({
      where: { id: { in: keepIds } },
      data: { poolId: null, enteredChallenge: true },
    });
    await tx.pool.deleteMany({ where: { id: { in: poolIds } } });
    for (const tid of tournamentIds) await scoreStandaloneMd3(tx, tid);
  });

  console.log("\n✓ Migration committed.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
