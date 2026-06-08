// End-to-end backend smoke test against the dev database. Verifies:
//   seed -> create pool -> import CSV submissions -> set answer key ->
//   recompute -> ranked leaderboard.
//
// Run with: DATABASE_URL=... npx tsx scripts/demo.ts

import { prisma } from "@/lib/db";
import { submissionToCsv } from "@/lib/scoring/csv";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Submission, type Results } from "@/lib/scoring/types";
import { parseSubmissionCsv, importSubmission } from "@/lib/pool/import";
import { recomputePool } from "@/lib/pool/scoring";

function sub(name: string, email: string, picks: Submission["picks"]): Submission {
  return { contestant: { name, email, tiebreak: "3" }, picks };
}

const groups = Object.keys(GROUPS);

// "Truth" answer key: 1st = team[0], 2nd = team[1] in each group; a few knockouts.
const answer: Results = {
  ...emptyPicks(),
  groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
  groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
  thirdAdvance: ["BRA", "USA", "ARG", "ESP"],
  knockout: { 73: "MEX", 89: "MEX", 104: "ARG" },
  awards: { player: "Messi", young: "Yamal", boot: "Kane", goal: "" },
  finalGoals: 3,
};

// Perfect-ish bracket (matches the answer key exactly).
const perfect = sub("Perfect Pat", "pat@example.com", {
  ...emptyPicks(),
  groupFirst: { ...answer.groupFirst },
  groupSecond: { ...answer.groupSecond },
  thirdAdvance: [...answer.thirdAdvance],
  knockout: { ...answer.knockout },
  awards: { ...answer.awards },
});

// Half-right bracket.
const middling = sub("Middling Mo", "mo@example.com", {
  ...emptyPicks(),
  groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])), // 1sts right
  groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][2]])), // 2nds wrong
  thirdAdvance: ["BRA", "USA"],
  knockout: { 73: "MEX", 104: "BRA" },
  awards: { player: "Messi", young: "", boot: "", goal: "" },
});

// Mostly-wrong bracket.
const wrong = sub("Wrong Wren", "wren@example.com", {
  ...emptyPicks(),
  groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][3]])),
  groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][2]])),
  thirdAdvance: ["GHA", "PAN"],
  knockout: { 73: "RSA" },
  awards: { player: "Nobody", young: "", boot: "", goal: "" },
});

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { slug: "wc2026" } });

  // Set the official answer key.
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { officialResults: answer as unknown as object, status: "LIVE" },
  });

  // A throwaway owner + pool.
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: { email: "owner@example.com", name: "Pool Owner" },
  });
  const existingPool = await prisma.pool.findFirst({ where: { joinCode: "DEMO01" } });
  const pool =
    existingPool ??
    (await prisma.pool.create({
      data: {
        tournamentId: tournament.id,
        name: "Demo Pool",
        ownerId: owner.id,
        joinCode: "DEMO01",
      },
    }));

  // Import each contestant via the real CSV path (serialize -> parse -> import).
  for (const s of [perfect, middling, wrong]) {
    const csv = submissionToCsv(s);
    const parsed = parseSubmissionCsv(csv);
    const res = await importSubmission(pool.id, parsed);
    console.log(`imported ${res.label} (${res.replaced ? "replaced" : "new"})`);
  }

  const leaderboard = await recomputePool(pool.id);

  console.log("\n=== LEADERBOARD ===");
  for (const row of leaderboard) {
    console.log(
      `#${row.rank}  ${row.label.padEnd(14)} ${String(row.total).padStart(3)} pts  ${JSON.stringify(row.breakdown)}`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
