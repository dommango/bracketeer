// Replay the HessFest 2026 pool + its contestant brackets into the database that
// the current DATABASE_URL points at. Built to run against Railway prod via:
//
//   railway run --service <bracketeer web service> npx tsx scripts/seed-hessfest.ts
//
// Idempotent and safe to re-run:
//   - the WC2026 tournament must already exist (the deploy preDeployCommand seeds
//     it via prisma/seed.ts) — this script refuses to run if it is missing;
//   - the owner User is upserted by email;
//   - the Pool is matched by its unique joinCode (created once, then reused);
//   - each bracket goes through importSubmission, which is idempotent by
//     (poolId, claimEmail, label): re-running replaces picks in place rather
//     than duplicating, so standings never change on a second run.
//
// Reads the gitignored bundle written by scripts/export-hessfest.ts.

import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { importSubmission } from "@/lib/pool/import";
import { recomputePool } from "@/lib/pool/scoring";
import type { SeedBundle } from "./export-hessfest";

const BUNDLE_PATH = "prisma/seed-data/hessfest.json";

async function main() {
  const bundle: SeedBundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
  const { pool: poolMeta, entries } = bundle;

  const tournament = await prisma.tournament.findUnique({
    where: { slug: poolMeta.tournamentSlug },
    select: { id: true },
  });
  if (!tournament) {
    throw new Error(
      `Tournament "${poolMeta.tournamentSlug}" is not seeded on this database. ` +
        `Run \`npx tsx prisma/seed.ts\` first (the Railway deploy does this automatically).`,
    );
  }

  // Push the answer key so the target DB scores against the same results as the
  // source. Skipped when the bundle carries none (so we never blank out a key
  // that prod may already have entered).
  if (bundle.officialResults !== null && bundle.officialResults !== undefined) {
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: bundle.officialResults as object },
    });
  }

  const owner = await prisma.user.upsert({
    where: { email: poolMeta.owner.email },
    update: {},
    create: { email: poolMeta.owner.email, name: poolMeta.owner.name },
    select: { id: true },
  });

  // Match by the unique joinCode so re-runs reuse the same pool rather than
  // creating a second one under a different cuid.
  const existingPool = await prisma.pool.findUnique({
    where: { joinCode: poolMeta.joinCode },
    select: { id: true },
  });
  const pool =
    existingPool ??
    (await prisma.pool.create({
      data: {
        name: poolMeta.name,
        joinCode: poolMeta.joinCode,
        tournamentId: tournament.id,
        ownerId: owner.id,
        settings: poolMeta.settings === null ? undefined : (poolMeta.settings as object),
      },
      select: { id: true },
    }));

  let created = 0;
  let replaced = 0;
  for (const entry of entries) {
    const res = await importSubmission(pool.id, entry.submission);
    if (res.replaced) replaced += 1;
    else created += 1;
    if (entry.locked) {
      await prisma.entry.update({ where: { id: res.entryId }, data: { locked: true } });
    }
  }

  // Populate the leaderboard cache against whatever officialResults this DB holds.
  await recomputePool(pool.id);

  const total = await prisma.entry.count({ where: { poolId: pool.id } });
  console.log(`Seeded "${poolMeta.name}" (join ${poolMeta.joinCode}) on this database.`);
  console.log(`  ${created} created, ${replaced} replaced this run; ${total} entries now in the pool.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
