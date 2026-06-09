// End-to-end verification of the Tier-2 feature selectors against the dev DB:
//   import entries -> set standings -> set an R32 result -> recompute ->
//   assert Match Center, Match detail (pick-split), the what-if projection, and
//   the player profile all read back correctly.
//
// Run with: <ENV> npx tsx scripts/verify-features.ts

import { prisma } from "@/lib/db";
import { submissionToCsv } from "@/lib/scoring/csv";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Submission } from "@/lib/scoring/types";
import { parseSubmissionCsv, importSubmission } from "@/lib/pool/import";
import { setGroupStandings, setKnockoutResult, recomputeTournamentPools } from "@/lib/pool/results";
import {
  getMatchCenter,
  getMatchDetail,
  getScoringContext,
  getEntriesWithPicks,
  getProfile,
} from "@/lib/pool/queries";
import { projectStandings } from "@/lib/pool/whatif";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (ok) pass += 1;
  else fail += 1;
}

const groups = Object.keys(GROUPS);
const HOME73 = GROUPS.A[1]; // pos-2 of group A — M73 home
const AWAY73 = GROUPS.B[1]; // pos-2 of group B — M73 away

function contestant(name: string, email: string, knockout: Record<number, string>): Submission {
  return {
    contestant: { name, email, tiebreak: "3" },
    picks: {
      ...emptyPicks(),
      groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
      groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
      thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
      knockout,
    },
  };
}

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { slug: "wc2026" } });
  const owner = await prisma.user.upsert({
    where: { email: "feat-owner@example.com" },
    update: {},
    create: { email: "feat-owner@example.com", name: "Feat Owner" },
  });
  const pool =
    (await prisma.pool.findFirst({ where: { joinCode: "FEATCK" } })) ??
    (await prisma.pool.create({
      data: { tournamentId: tournament.id, name: "Feature Pool", ownerId: owner.id, joinCode: "FEATCK" },
    }));

  // Ana picks the M73 home team to win; Bo picks the away team.
  await importSubmission(
    pool.id,
    parseSubmissionCsv(submissionToCsv(contestant("Ana Feature", "ana-feat@example.com", { 73: HOME73 }))),
  );
  await importSubmission(
    pool.id,
    parseSubmissionCsv(submissionToCsv(contestant("Bo Feature", "bo-feat@example.com", { 73: AWAY73 }))),
  );

  console.log("\n[setup] standings + M73 result");
  await setGroupStandings(tournament.id, {
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
  });
  await setKnockoutResult(tournament.id, 73, { winnerCode: HOME73, homeScore: 2, awayScore: 1 });
  await recomputeTournamentPools(tournament.id);

  console.log("\n[1] Match Center");
  const sections = await getMatchCenter(pool.id, null);
  const codesInOrder = sections.map((s) => s.roundCode);
  check("rounds in tournament order", codesInOrder.join(",").startsWith("GROUP,R32"), codesInOrder.join(","));
  const r32 = sections.find((s) => s.roundCode === "R32");
  const m73 = r32?.matches.find((m) => m.matchNo === 73);
  check("M73 resolved teams", m73?.home.code === HOME73 && m73?.away.code === AWAY73, `${m73?.home.code} v ${m73?.away.code}`);
  check("M73 is FINAL with the recorded winner", m73?.status === "FINAL" && m73?.winnerCode === HOME73);

  console.log("\n[2] Match detail + pick-split");
  const detail = await getMatchDetail(pool.id, 73, null);
  check("scored knockout match", detail?.scored === true);
  check("pick-split total = 2", detail?.pickSplit?.total === 2, `${detail?.pickSplit?.total}`);
  check(
    "pick-split home=1 / away=1",
    detail?.pickSplit?.home.count === 1 && detail?.pickSplit?.away.count === 1,
    `home ${detail?.pickSplit?.home.count}, away ${detail?.pickSplit?.away.count}`,
  );

  console.log("\n[3] What-if projection (away team wins instead)");
  const ctx = await getScoringContext(pool.id);
  const entries = await getEntriesWithPicks(pool.id);
  const projected = projectStandings(entries, ctx!.results, { matchNo: 73, winnerCode: AWAY73 }, ctx!.scoringConfig);
  const ana = projected.find((r) => r.label === "Ana Feature");
  const bo = projected.find((r) => r.label === "Bo Feature");
  check("Ana loses the R32 point if the away team wins", ana?.delta === -1, `${ana?.delta}`);
  check("Bo gains the R32 point", bo?.delta === 1, `${bo?.delta}`);

  console.log("\n[4] Player profile");
  const anaEntry = await prisma.entry.findFirstOrThrow({ where: { poolId: pool.id, label: "Ana Feature" } });
  const profile = await getProfile(pool.id, anaEntry.id);
  const hit73 = profile?.hitGrid.find((h) => h.matchNo === 73);
  check("M73 is a hit on Ana's grid", hit73?.result === "hit");
  check("accuracy reflects the single decided pick", profile?.accuracy.hits === 1 && profile?.accuracy.decided === 1, `${profile?.accuracy.pct}%`);
  check("boldest call surfaces M73", profile?.boldest?.matchNo === 73, `${profile?.boldest?.sharePct}% shared`);

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
