// End-to-end verification of the new backend services against the dev DB:
//   import -> set standings -> set knockout winners (with propagation) ->
//   reject an invalid winner -> recompute -> claim an entry.
//
// Run with: <ENV> npx tsx scripts/verify-backend.ts

import { prisma } from "@/lib/db";
import { submissionToCsv } from "@/lib/scoring/csv";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Submission } from "@/lib/scoring/types";
import { parseSubmissionCsv, importSubmission } from "@/lib/pool/import";
import {
  setGroupStandings,
  setKnockoutResult,
  recomputeTournamentPools,
} from "@/lib/pool/results";
import { resolveBracket } from "@/lib/pool/bracket";
import { asResults } from "@/lib/pool/scoring";
import { getLeaderboard } from "@/lib/pool/scoring";
import { claimEntriesForUser } from "@/lib/auth/claim";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

const groups = Object.keys(GROUPS);

function contestant(name: string, email: string, picks: Submission["picks"]): Submission {
  return { contestant: { name, email, tiebreak: "3" }, picks };
}

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { slug: "wc2026" } });

  // Fresh, isolated pool.
  const owner = await prisma.user.upsert({
    where: { email: "verify-owner@example.com" },
    update: {},
    create: { email: "verify-owner@example.com", name: "Verify Owner" },
  });
  const pool =
    (await prisma.pool.findFirst({ where: { joinCode: "VERIFY" } })) ??
    (await prisma.pool.create({
      data: { tournamentId: tournament.id, name: "Verify Pool", ownerId: owner.id, joinCode: "VERIFY" },
    }));

  // Chalk-ish entry that mirrors the answer key we will set.
  const chalk = contestant("Chalk Charlie", "chalk-charlie@example.com", {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
    knockout: { 73: GROUPS.A[1] },
  });
  await importSubmission(pool.id, parseSubmissionCsv(submissionToCsv(chalk)));

  console.log("\n[1] Group standings");
  await setGroupStandings(tournament.id, {
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
  });
  let answer = asResults(
    (await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).officialResults,
  );
  check("standings persisted", answer.groupFirst.A === GROUPS.A[0], `A 1st = ${answer.groupFirst.A}`);

  console.log("\n[2] Knockout winner + propagation");
  // M73 is {pos2 A} vs {pos2 B}; its home side is groupSecond[A].
  const home73 = resolveBracket(answer)[73].home;
  await setKnockoutResult(tournament.id, 73, { winnerCode: home73!, homeScore: 2, awayScore: 1 });
  answer = asResults(
    (await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).officialResults,
  );
  check("knockout winner persisted", answer.knockout[73] === home73, `M73 winner = ${answer.knockout[73]}`);

  // 73 feeds R16 match 90 (a:73, b:75); its home slot should now be the M73 winner.
  const feeds90 = resolveBracket(answer)[90].home;
  check("winner propagated into R16 feeder", feeds90 === home73, `M90 home = ${feeds90}`);

  // The Result row was mirrored for display.
  const resultRow = await prisma.result.findFirst({
    where: { match: { tournamentId: tournament.id, matchNo: 73 } },
  });
  check("Result row mirrored (MANUAL)", resultRow?.source === "MANUAL" && resultRow?.winnerCode === home73);

  console.log("\n[3] Invalid winner is rejected");
  let rejected = false;
  try {
    await setKnockoutResult(tournament.id, 73, { winnerCode: "GHA" }); // not in M73
  } catch {
    rejected = true;
  }
  check("setKnockoutResult rejects a team not in the match", rejected);

  console.log("\n[4] Recompute");
  const poolsTouched = await recomputeTournamentPools(tournament.id);
  check("recomputed >=1 pool", poolsTouched >= 1, `${poolsTouched} pools`);
  const board = await getLeaderboard(pool.id);
  const charlie = board.find((r) => r.label === "Chalk Charlie");
  check("chalk entry scored > 0", (charlie?.total ?? 0) > 0, `${charlie?.total} pts`);

  console.log("\n[5] Entry claiming");
  const claimer = await prisma.user.upsert({
    where: { email: "chalk-charlie@example.com" },
    update: {},
    create: { email: "chalk-charlie@example.com", name: "Charlie" },
  });
  // Ensure the entry is unclaimed before we test claiming.
  await prisma.entry.updateMany({
    where: { poolId: pool.id, claimEmail: "chalk-charlie@example.com" },
    data: { userId: null },
  });
  const claimed = await claimEntriesForUser(claimer.id, "chalk-charlie@example.com");
  check("claimEntriesForUser bound >=1 entry", claimed >= 1, `${claimed} entries`);
  const membership = await prisma.membership.findUnique({
    where: { poolId_userId: { poolId: pool.id, userId: claimer.id } },
  });
  check("membership created on claim", Boolean(membership));

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
