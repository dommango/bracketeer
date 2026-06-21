// Backend smoke test for the solo-bracket + master-tournament flow. Verifies:
//   master pool is created once (idempotent) ->
//   saveSoloBracket is gated when the knockout field isn't set ->
//   two players build solo brackets (no pool membership) ->
//   getMasterLeaderboard shows ONLY opted-in brackets, ranked ->
//   toggling enteredMaster adds/removes a bracket from the public board.
//
// Mutates the wc2026 answer key + Match-73 schedule, then restores them.
// Run with: DATABASE_URL=... AUTH_SECRET=... npx tsx scripts/solo-smoke.ts

import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";
import { resolveR32Slots } from "@/lib/scoring/resolve";
import { resolveKnockout } from "@/lib/pool/pick-form";
import { getOrCreateMasterPool } from "@/lib/master/pool";
import { saveSoloBracket, setEnteredMaster, getSoloBracket } from "@/lib/master/solo";
import { getMasterLeaderboard } from "@/lib/master/leaderboard";

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

  try {
    // 1. Master pool is created once and reused.
    const p1 = await getOrCreateMasterPool(tournament.id);
    const p2 = await getOrCreateMasterPool(tournament.id);
    assert(p1 === p2, "getOrCreateMasterPool is idempotent");

    // 2. Closed field -> save is rejected.
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: { ...emptyPicks(), finalGoals: null } as unknown as object },
    });
    const u1 = await prisma.user.upsert({
      where: { email: "solo1@example.com" },
      update: {},
      create: { email: "solo1@example.com", name: "Solo One" },
    });
    let rejected = false;
    try {
      await saveSoloBracket({ userId: u1.id, label: "Solo One", tiebreak: "3", picks: emptyPicks() });
    } catch {
      rejected = true;
    }
    assert(rejected, "saveSoloBracket rejects picks before the field is set");

    // 3. Open the field + push the R32 kickoff into the future, then build two brackets.
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

    const u2 = await prisma.user.upsert({
      where: { email: "solo2@example.com" },
      update: {},
      create: { email: "solo2@example.com", name: "Solo Two" },
    });

    await saveSoloBracket({ userId: u1.id, label: "Solo One", tiebreak: "3", picks });
    await saveSoloBracket({ userId: u2.id, label: "Solo Two", tiebreak: "2", picks });

    const b1 = await getSoloBracket(u1.id);
    assert(b1 !== null && !b1.enteredMaster, "solo bracket is private by default");

    // No membership rows were created for solo players.
    const poolId = await getOrCreateMasterPool(tournament.id);
    const memberCount = await prisma.membership.count({
      where: { poolId, userId: { in: [u1.id, u2.id] } },
    });
    assert(memberCount === 0, "solo players are not pool members");

    // 4. Master leaderboard hides private brackets.
    assert((await getMasterLeaderboard()).length === 0, "leaderboard empty when none opted in");

    await setEnteredMaster(u1.id, true);
    let board = await getMasterLeaderboard();
    assert(board.length === 1 && board[0].userId === u1.id, "opting in adds exactly one bracket");

    await setEnteredMaster(u2.id, true);
    board = await getMasterLeaderboard();
    assert(board.length === 2, "second opt-in adds the second bracket");
    assert(
      board.every((r, i) => r.rank === (i === 0 ? 1 : board[0].total === r.total ? 1 : i + 1)),
      "leaderboard is ranked",
    );

    // 5. Opting back out removes it.
    await setEnteredMaster(u1.id, false);
    board = await getMasterLeaderboard();
    assert(
      board.length === 1 && board[0].userId === u2.id,
      "opting out removes the bracket from the board",
    );

    console.log("\nALL SOLO SMOKE CHECKS PASSED");

    // Cleanup: remove the two test entries + users.
    await prisma.entry.deleteMany({ where: { poolId, userId: { in: [u1.id, u2.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  } finally {
    // Restore the answer key + schedule we mutated.
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
