// One-off data fix: fill in Nick Barattucci's four blank player-award picks in
// the HessFest 2026 pool. Safe to run against any database (dev or Railway prod)
// because it matches the entry by name within the pool rather than a hardcoded
// id -- prod entry ids differ from dev. Aborts if the name match is not unique.
//
// Dry-run by default (prints the plan, writes nothing). Pass --apply to commit.
//
// Against Railway prod:   railway run npx tsx scripts/fix-nick-awards.ts --apply
// Against the dev DB:      <ENV pointing at dev DB> npx tsx scripts/fix-nick-awards.ts --apply

import { prisma } from "@/lib/db";
import { recomputePool } from "@/lib/pool/scoring";

const POOL_NAME = "HessFest 2026";
const ENTRY_LABEL = "Nick Barattucci";

// award key (Pick.key in section "player_awards") -> value to set
const AWARDS: Record<string, string> = {
  player_of_the_tournament: "Pedri",
  young_player_of_the_tournament: "Lamine Yamal",
  golden_boot: "Harry Kane",
  goal_of_the_tournament: "Mbappe",
};

async function main() {
  const apply = process.argv.includes("--apply");

  const pool = await prisma.pool.findFirstOrThrow({
    where: { name: POOL_NAME },
    select: { id: true, name: true, joinCode: true },
  });

  const matches = await prisma.entry.findMany({
    where: { poolId: pool.id, label: ENTRY_LABEL },
    select: {
      id: true,
      label: true,
      locked: true,
      picks: {
        where: { section: "player_awards" },
        select: { key: true, teamOrValue: true },
        orderBy: { key: "asc" },
      },
    },
  });

  if (matches.length === 0) {
    throw new Error(`No entry labelled "${ENTRY_LABEL}" in pool "${pool.name}" (${pool.joinCode}).`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous: ${matches.length} entries labelled "${ENTRY_LABEL}" (ids: ${matches.map((m) => m.id).join(", ")}). Refusing to guess.`,
    );
  }

  const entry = matches[0];
  console.log(`Pool   : ${pool.name} (${pool.joinCode})`);
  console.log(`Entry  : ${entry.label}  [${entry.id}]  locked=${entry.locked}`);
  console.log(`Mode   : ${apply ? "APPLY (writing)" : "DRY RUN (no writes -- pass --apply to commit)"}`);
  console.log("Plan:");
  const current = new Map(entry.picks.map((p) => [p.key, p.teamOrValue]));
  for (const [key, value] of Object.entries(AWARDS)) {
    const had = current.get(key);
    if (had === undefined) {
      console.log(`  ! ${key}: no row present (will be skipped -- not found)`);
    } else {
      console.log(`    ${key}: "${had}" -> "${value}"`);
    }
  }

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to write these changes.");
    return;
  }

  for (const [key, value] of Object.entries(AWARDS)) {
    const res = await prisma.pick.updateMany({
      where: { entryId: entry.id, section: "player_awards", key },
      data: { teamOrValue: value },
    });
    console.log(`  set ${key} = "${value}" (rows: ${res.count})`);
  }

  await recomputePool(pool.id);
  console.log(`Recomputed pool ${pool.id}. Done.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
