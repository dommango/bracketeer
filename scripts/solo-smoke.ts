// Backend smoke test for the standalone-bracket + Bracketeer Knockout Challenge
// flow. Verifies:
//   saveSoloBracket is gated when the knockout field isn't set ->
//   two players build standalone brackets (poolId null, no pool membership) ->
//   getChallengeLeaderboard shows ONLY opted-in brackets, ranked ->
//   toggling enteredChallenge adds/removes a bracket from the public board ->
//   the Challenge is knockout-only (a full-bracket entry can't enter) ->
//   recomputeStandalone rescores standalone entries when results land.
//
// Mutates the wc2026 answer key + Match-73 schedule, then restores them.
// Run with: DATABASE_URL=... AUTH_SECRET=... npx tsx scripts/solo-smoke.ts

import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";
import { resolveR32Slots } from "@/lib/scoring/resolve";
import { resolveKnockout } from "@/lib/pool/pick-form";
import { saveSoloBracket, setEnteredChallenge, getSoloBracket } from "@/lib/challenge/solo";
import { getChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { recomputeStandalone } from "@/lib/pool/scoring";

const groups = Object.keys(GROUPS);

// A complete, resolvable answer key so the knockout field is "set" (picks open).
const answer: Results = {
  ...emptyPicks(),
  groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
  groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
  thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
  knockout: {},
  awards: { player: "", young: "", boot: "", goal: "" },
  finalGoals: null,
};

// Pick the 'a' side of every match, cascading winners forward until all 31 are
// set — a complete, internally-consistent knockout bracket for the given seed.
function fillKnockout(seed: ReturnType<typeof resolveR32Slots>): Picks {
  let picks: Picks = { ...emptyPicks(), awards: { player: "A", young: "B", boot: "C", goal: "D" } };
  for (let pass = 0; pass < 6; pass++) {
    const m = resolveKnockout(picks, seed);
    const slots = [...m.r32, ...m.r16, ...m.qf, ...m.sf, m.final];
    const knockout = { ...picks.knockout };
    for (const s of slots) if (s.a && !knockout[s.matchNo]) knockout[s.matchNo] = s.a.code;
    picks = { ...picks, knockout };
  }
  return picks;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { slug: "wc2026" } });
  const prevResults = tournament.officialResults;
  const m73 = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 73 } },
    select: { scheduledAt: true },
  });
  const prevM73 = m73?.scheduledAt ?? null;

  const cleanupUserIds: string[] = [];

  try {
    // 1. Closed field -> save is rejected.
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: { ...emptyPicks(), finalGoals: null } as unknown as object },
    });
    const u1 = await prisma.user.upsert({
      where: { email: "solo1@example.com" },
      update: {},
      create: { email: "solo1@example.com", name: "Solo One" },
    });
    const u2 = await prisma.user.upsert({
      where: { email: "solo2@example.com" },
      update: {},
      create: { email: "solo2@example.com", name: "Solo Two" },
    });
    cleanupUserIds.push(u1.id, u2.id);

    let rejected = false;
    try {
      await saveSoloBracket({ userId: u1.id, label: "Solo One", tiebreak: "3", picks: emptyPicks() });
    } catch {
      rejected = true;
    }
    assert(rejected, "saveSoloBracket rejects picks before the field is set");

    // 2. Open the field + push the R32 kickoff into the future, then build two brackets.
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: answer as unknown as object },
    });
    await prisma.match.update({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 73 } },
      data: { scheduledAt: new Date("2030-01-01T00:00:00Z") },
    });
    const seed = resolveR32Slots(answer);
    assert(
      [...Array(16)].every((_, i) => seed[73 + i]?.a && seed[73 + i]?.b),
      "answer key seats all 16 Round-of-32 matches",
    );
    const picks = fillKnockout(seed);

    await saveSoloBracket({ userId: u1.id, label: "Solo One", tiebreak: "3", picks });
    await saveSoloBracket({ userId: u2.id, label: "Solo Two", tiebreak: "2", picks });

    const b1 = await getSoloBracket(u1.id);
    assert(b1 !== null && !b1.enteredChallenge, "standalone bracket is private by default");

    // 3. Standalone brackets live outside any pool — no poolId, no membership.
    const e1 = await prisma.entry.findUniqueOrThrow({
      where: { id: b1!.entryId },
      select: { poolId: true, tournamentId: true, format: true },
    });
    assert(e1.poolId === null, "standalone bracket has no pool");
    assert(e1.tournamentId === tournament.id, "standalone bracket carries its tournamentId");
    assert(e1.format === "KNOCKOUT", "standalone solo bracket is KNOCKOUT");
    const memberCount = await prisma.membership.count({
      where: { userId: { in: [u1.id, u2.id] } },
    });
    assert(memberCount === 0, "solo players are not pool members");

    // 4. Challenge leaderboard hides brackets that haven't entered.
    assert((await getChallengeLeaderboard()).length === 0, "leaderboard empty when none entered");

    await setEnteredChallenge(u1.id, b1!.entryId, true);
    let board = await getChallengeLeaderboard();
    assert(board.length === 1 && board[0].userId === u1.id, "entering adds exactly one bracket");

    const b2 = await getSoloBracket(u2.id);
    await setEnteredChallenge(u2.id, b2!.entryId, true);
    board = await getChallengeLeaderboard();
    assert(board.length === 2, "second entry adds the second bracket");
    assert(
      board.every((r, i) => r.rank === (i === 0 ? 1 : board[0].total === r.total ? 1 : i + 1)),
      "leaderboard is ranked",
    );

    // 5. Opting back out removes it.
    await setEnteredChallenge(u1.id, b1!.entryId, false);
    board = await getChallengeLeaderboard();
    assert(
      board.length === 1 && board[0].userId === u2.id,
      "opting out removes the bracket from the board",
    );

    // 6. The Challenge is knockout-only: a standalone FULL_BRACKET entry is gated.
    const groupEntry = await prisma.entry.create({
      data: {
        tournamentId: tournament.id,
        poolId: null,
        format: "FULL_BRACKET",
        userId: u1.id,
        label: "Group Bracket",
        importedFrom: "UI",
      },
    });
    const gated = await setEnteredChallenge(u1.id, groupEntry.id, true);
    assert(gated.notFound === true, "a full-bracket entry can't enter the knockout Challenge");

    // 7. recomputeStandalone rescores standalone entries when results land. The
    //    answer key has the group stage filled; add a knockout winner matching the
    //    a-side picks so the entered bracket scores some points.
    const winner73 = seed[73]!.a!;
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: { ...answer, knockout: { 73: winner73 } } as unknown as object },
    });
    const n = await recomputeStandalone(tournament.id);
    assert(n >= 2, "recomputeStandalone scored every standalone entry");
    const scored = await prisma.scoreBreakdown.findUniqueOrThrow({ where: { entryId: b2!.entryId } });
    assert(scored.totalPoints > 0, "standalone entry scored against the landed knockout result");

    console.log("\nALL SOLO SMOKE CHECKS PASSED");
  } finally {
    // Cleanup: remove test entries + users, restore the answer key + schedule.
    await prisma.entry.deleteMany({ where: { userId: { in: cleanupUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: (prevResults ?? null) as unknown as object },
    });
    await prisma.match.update({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 73 } },
      data: { scheduledAt: prevM73 },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
