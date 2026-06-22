// Regression checks for the two HIGH bugs found in the QA loop:
//   MD3-1  — toggling an MD3 entry into the public challenge clobbered its score
//            to 0 (recomputeEntry used the full-bracket oracle, not the MD3 engine).
//   AUTH-1 — the entry-claim path enrolled members with no tier-cap check, so a
//            FREE pool could be pushed past FREE_MEMBER_CAP via CSV import + sign-in.
//
// Creates throwaway data, asserts, and cleans up. Mutates no seeded rows.
// Run with the standard inline-env prefix (DB on port 5433).

import { prisma } from "@/lib/db";
import { claimEntriesForUser } from "@/lib/auth/claim";
import { upsertMd3Picks } from "@/lib/pool/md3-picks";
import { md3Fixtures } from "@/lib/pool/match-day-3";
import { recomputePool, getLeaderboard } from "@/lib/pool/scoring";
import { setEnteredChallenge } from "@/lib/challenge/solo";
import { FREE_MEMBER_CAP } from "@/lib/billing/entitlements";
import { DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ""}`);
  }
}

function code(suffix: string): string {
  return ("QAFIX" + suffix).toUpperCase().slice(0, 6).padEnd(6, "Z");
}

async function main() {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: DEFAULT_TOURNAMENT_SLUG } });

  // ---- MD3-1: challenge toggle must preserve an MD3 entry's score ----------
  console.log("\n[MD3-1] challenge toggle preserves MD3 score");
  const md3Owner = await prisma.user.upsert({
    where: { email: "qafix.md3@seed.test" },
    update: {},
    create: { email: "qafix.md3@seed.test", name: "QAFix MD3" },
    select: { id: true },
  });
  // Throwaway MD3 pool (sees the tournament's shared FINAL MD3 results).
  await prisma.pool.deleteMany({ where: { joinCode: code("M") } });
  const md3Pool = await prisma.pool.create({
    data: {
      tournamentId: t.id, name: "QAFix MD3 Pool", ownerId: md3Owner.id, joinCode: code("M"),
      format: "MATCH_DAY_3_PICKEM",
      memberships: { create: { userId: md3Owner.id, role: "OWNER", displayName: "QAFix" } },
    },
    select: { id: true },
  });

  // Find a FINAL MD3 result and predict it exactly (guaranteed > 0 points).
  const fixtures = md3Fixtures();
  const md3MatchNos = fixtures.map((f) => f.matchNo);
  const finalResult = await prisma.result.findFirst({
    where: { status: "FINAL", match: { tournamentId: t.id, matchNo: { in: md3MatchNos } } },
    select: { homeTeamCode: true, awayTeamCode: true, homeScore: true, awayScore: true, match: { select: { matchNo: true } } },
  });
  if (!finalResult || finalResult.homeScore === null || finalResult.awayScore === null) {
    console.log("  (skipped — no FINAL MD3 result seeded; run qa-seed first)");
  } else {
    const fixture = fixtures.find((f) => f.matchNo === finalResult.match.matchNo)!;
    // Orient prediction to the fixture's canonical home/away by team code.
    const predHome = finalResult.homeTeamCode === fixture.homeCode ? finalResult.homeScore : finalResult.awayScore;
    const predAway = finalResult.homeTeamCode === fixture.homeCode ? finalResult.awayScore : finalResult.homeScore;
    await upsertMd3Picks(
      { poolId: md3Pool.id, userId: md3Owner.id, label: "QAFix", scores: { [fixture.matchNo]: { home: predHome, away: predAway } } },
      new Date("2026-06-01T00:00:00Z"), // before any kickoff → writable
    );
    await recomputePool(md3Pool.id);
    const before = await getLeaderboard(md3Pool.id);
    const scoreBefore = before[0]?.total ?? 0;
    check("entry scores > 0 before toggle", scoreBefore > 0, `${scoreBefore} pts`);

    const entry = await prisma.entry.findFirstOrThrow({ where: { poolId: md3Pool.id }, select: { id: true } });
    await setEnteredChallenge(md3Owner.id, entry.id, true);
    const afterIn = (await getLeaderboard(md3Pool.id))[0]?.total ?? 0;
    check("score preserved after opting INTO challenge", afterIn === scoreBefore, `${afterIn} pts (was ${scoreBefore})`);

    await setEnteredChallenge(md3Owner.id, entry.id, false);
    const afterOut = (await getLeaderboard(md3Pool.id))[0]?.total ?? 0;
    check("score preserved after opting OUT of challenge", afterOut === scoreBefore, `${afterOut} pts (was ${scoreBefore})`);
  }
  await prisma.pool.delete({ where: { id: md3Pool.id } });

  // ---- AUTH-1: claim path must respect the FREE member cap -----------------
  console.log("\n[AUTH-1] claim path respects FREE member cap");
  await prisma.pool.deleteMany({ where: { joinCode: { in: [code("C"), code("U")] } } });
  const capOwner = await prisma.user.upsert({
    where: { email: "qafix.capowner@seed.test" },
    update: {},
    create: { email: "qafix.capowner@seed.test", name: "QAFix CapOwner" },
    select: { id: true },
  });

  // A FREE pool filled to exactly the cap.
  const capPool = await prisma.pool.create({
    data: {
      tournamentId: t.id, name: "QAFix Cap Pool", ownerId: capOwner.id, joinCode: code("C"),
      format: "KNOCKOUT", tier: "FREE",
      memberships: { create: { userId: capOwner.id, role: "OWNER", displayName: "Owner" } },
    },
    select: { id: true },
  });
  // Add filler members up to the cap.
  for (let i = 1; i < FREE_MEMBER_CAP; i++) {
    const u = await prisma.user.upsert({
      where: { email: `qafix.filler${i}@seed.test` },
      update: {},
      create: { email: `qafix.filler${i}@seed.test`, name: `Filler ${i}` },
      select: { id: true },
    });
    await prisma.membership.upsert({
      where: { poolId_userId: { poolId: capPool.id, userId: u.id } },
      update: {},
      create: { poolId: capPool.id, userId: u.id, role: "MEMBER", displayName: `Filler ${i}` },
    });
  }
  const atCap = await prisma.membership.count({ where: { poolId: capPool.id } });
  check("pool is at cap before claim", atCap === FREE_MEMBER_CAP, `${atCap}/${FREE_MEMBER_CAP}`);

  // An imported, unclaimed entry for a brand-new account.
  const claimer = await prisma.user.upsert({
    where: { email: "qafix.claimer@seed.test" },
    update: {},
    create: { email: "qafix.claimer@seed.test", name: "QAFix Claimer" },
    select: { id: true },
  });
  await prisma.entry.deleteMany({ where: { claimEmail: "qafix.claimer@seed.test" } });
  await prisma.entry.create({
    data: {
      poolId: capPool.id, tournamentId: t.id, format: "KNOCKOUT",
      label: "Claimer Bracket", claimEmail: "qafix.claimer@seed.test", importedFrom: "CSV",
    },
  });

  const claimed = await claimEntriesForUser(claimer.id, "qafix.claimer@seed.test");
  const boundEntry = await prisma.entry.findFirstOrThrow({ where: { claimEmail: "qafix.claimer@seed.test" }, select: { userId: true } });
  const afterClaim = await prisma.membership.count({ where: { poolId: capPool.id } });
  const claimerIsMember = await prisma.membership.findUnique({
    where: { poolId_userId: { poolId: capPool.id, userId: claimer.id } },
    select: { id: true },
  });
  check("entry still bound to the claiming account", boundEntry.userId === claimer.id, `claimed=${claimed}`);
  check("FREE pool NOT pushed past cap by claim", afterClaim === FREE_MEMBER_CAP, `${afterClaim}/${FREE_MEMBER_CAP}`);
  check("over-cap claimer was NOT auto-enrolled as a member", !claimerIsMember);

  // Control: an UNDER-cap FREE pool DOES enroll the claimer (claim still works).
  const underPool = await prisma.pool.create({
    data: {
      tournamentId: t.id, name: "QAFix Under Pool", ownerId: capOwner.id, joinCode: code("U"),
      format: "KNOCKOUT", tier: "FREE",
      memberships: { create: { userId: capOwner.id, role: "OWNER", displayName: "Owner" } },
    },
    select: { id: true },
  });
  await prisma.entry.create({
    data: {
      poolId: underPool.id, tournamentId: t.id, format: "KNOCKOUT",
      label: "Claimer Bracket 2", claimEmail: "qafix.claimer2@seed.test", importedFrom: "CSV",
    },
  });
  const claimer2 = await prisma.user.upsert({
    where: { email: "qafix.claimer2@seed.test" },
    update: {},
    create: { email: "qafix.claimer2@seed.test", name: "QAFix Claimer2" },
    select: { id: true },
  });
  await claimEntriesForUser(claimer2.id, "qafix.claimer2@seed.test");
  const enrolled = await prisma.membership.findUnique({
    where: { poolId_userId: { poolId: underPool.id, userId: claimer2.id } },
    select: { id: true },
  });
  check("under-cap claim still enrolls the member (no regression)", Boolean(enrolled));

  // Cleanup throwaway pools + users.
  await prisma.pool.delete({ where: { id: capPool.id } });
  await prisma.pool.delete({ where: { id: underPool.id } });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "qafix." } },
  });

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
