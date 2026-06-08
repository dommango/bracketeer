// Import every CSV in fixtures/csv into a pool and print the leaderboard.
// Exercises the real import path (incl. messy/no-BOM/partial files).
//
// Run with: DATABASE_URL=... AUTH_SECRET=... CRON_SECRET=... npx tsx scripts/import-fixtures.ts

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Results } from "@/lib/scoring/types";
import { parseSubmissionCsv, importSubmission } from "@/lib/pool/import";
import { recomputePool } from "@/lib/pool/scoring";

const groups = Object.keys(GROUPS);

// A "chalk" answer key so the score spread is meaningful.
const answer: Results = {
  ...emptyPicks(),
  groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
  groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
  thirdAdvance: ["BRA", "ARG", "FRA", "ESP", "ENG", "POR", "GER", "NED"],
  knockout: { 73: "MEX", 89: "BRA", 97: "BRA", 101: "BRA", 104: "ARG" },
  awards: { player: "Lamine Yamal", young: "Lamine Yamal", boot: "Kylian Mbappe", goal: "" },
  finalGoals: 3,
};

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { slug: "wc2026" } });
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { officialResults: answer as unknown as object, status: "LIVE" },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: { email: "owner@example.com", name: "Pool Owner" },
  });
  const pool =
    (await prisma.pool.findFirst({ where: { joinCode: "FIXTUR" } })) ??
    (await prisma.pool.create({
      data: { tournamentId: tournament.id, name: "Fixtures Pool", ownerId: owner.id, joinCode: "FIXTUR" },
    }));

  const dir = join(process.cwd(), "fixtures", "csv");
  const files = readdirSync(dir).filter((f) => f.endsWith(".csv"));
  let ok = 0;
  for (const f of files) {
    try {
      const text = readFileSync(join(dir, f), "utf8");
      const sub = parseSubmissionCsv(text);
      const res = await importSubmission(pool.id, sub);
      console.log(`  ✓ ${f.padEnd(34)} -> ${res.label} (${res.replaced ? "replaced" : "new"})`);
      ok++;
    } catch (e) {
      console.log(`  ✗ ${f.padEnd(34)} -> ${(e as Error).message}`);
    }
  }
  console.log(`\nImported ${ok}/${files.length} fixtures.`);

  const leaderboard = await recomputePool(pool.id);
  console.log("\n=== LEADERBOARD (vs chalk answer key) ===");
  for (const row of leaderboard) {
    const b = row.breakdown as Record<string, number> | null;
    const detail = b ? `g${b.group} 3rd${b.thirds} ko${b.r32 + b.r16 + b.qf + b.sf + b.final} aw${b.awards}` : "";
    console.log(`  #${String(row.rank).padStart(2)}  ${row.label.padEnd(16)} ${String(row.total).padStart(3)} pts   ${detail}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
