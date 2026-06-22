// Backend smoke test for the multi-bracket management flow. Verifies:
//   a user builds TWO standalone knockout brackets (each its own Entry) ->
//   getUserBrackets lists both as standalone ->
//   attachEntryToPool moves one into a KNOCKOUT pool (membership + leaderboard) ->
//   the moved bracket can ALSO enter the Challenge (in a pool AND the Challenge) ->
//   the other bracket stays standalone ->
//   attach rejects: already-in-a-pool, format mismatch, bad join code.
//
// Mutates the wc2026 answer key + Match-73 schedule, then restores them.
// Run with: DATABASE_URL=... AUTH_SECRET=... npx tsx scripts/multi-bracket-smoke.ts

import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";
import { resolveR32Slots } from "@/lib/scoring/resolve";
import { resolveKnockout } from "@/lib/pool/pick-form";
import { saveSoloBracket, setEnteredChallenge } from "@/lib/challenge/solo";
import { getChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { getUserBrackets } from "@/lib/bracket/gallery";
import { createPool, attachEntryToPool } from "@/lib/pool/manage";
import { getLeaderboard } from "@/lib/pool/scoring";

const groups = Object.keys(GROUPS);

const answer: Results = {
  ...emptyPicks(),
  groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
  groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
  thirdAdvance: groups.slice(0, 8).map((g) => GROUPS[g][2]),
  knockout: {},
  awards: { player: "", young: "", boot: "", goal: "" },
  finalGoals: null,
};

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

async function rejects(fn: () => Promise<unknown>, match: string, msg: string) {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = (e as Error).message.toLowerCase().includes(match.toLowerCase());
  }
  assert(threw, msg);
}

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { slug: "wc2026" } });
  const prevResults = tournament.officialResults;
  const m73 = await prisma.match.findUnique({
    where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 73 } },
    select: { scheduledAt: true },
  });
  const prevM73 = m73?.scheduledAt ?? null;

  const userIds: string[] = [];
  const poolIds: string[] = [];

  try {
    // Open the knockout field + push the R32 kickoff into the future.
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: answer as unknown as object },
    });
    await prisma.match.update({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 73 } },
      data: { scheduledAt: new Date("2030-01-01T00:00:00Z") },
    });
    const seed = resolveR32Slots(answer);
    const picks = fillKnockout(seed);

    const player = await prisma.user.upsert({
      where: { email: "multi-player@example.com" },
      update: {},
      create: { email: "multi-player@example.com", name: "Multi Player" },
    });
    const owner = await prisma.user.upsert({
      where: { email: "multi-owner@example.com" },
      update: {},
      create: { email: "multi-owner@example.com", name: "Pool Owner" },
    });
    userIds.push(player.id, owner.id);

    // 1. Two standalone brackets, each its own Entry.
    const a = await saveSoloBracket({ userId: player.id, label: "Alpha", tiebreak: "3", picks });
    const b = await saveSoloBracket({ userId: player.id, label: "Beta", tiebreak: "2", picks });
    assert(a.entryId !== b.entryId, "two distinct standalone brackets created");

    let gallery = await getUserBrackets(player.id, tournament.id);
    assert(gallery.length === 2, "gallery lists both brackets");
    assert(
      gallery.every((g) => g.placement.kind === "standalone"),
      "both brackets start standalone",
    );

    // 2. Create a KNOCKOUT pool and attach the first bracket to it.
    const pool = await createPool({
      userId: owner.id,
      name: "Knockout League",
      displayName: "Owner",
      format: "KNOCKOUT",
    });
    poolIds.push(pool.id);

    const attached = await attachEntryToPool({
      userId: player.id,
      entryId: a.entryId,
      joinCode: pool.joinCode,
    });
    assert(attached.poolId === pool.id, "attachEntryToPool returns the pool");

    const movedEntry = await prisma.entry.findUniqueOrThrow({
      where: { id: a.entryId },
      select: { poolId: true },
    });
    assert(movedEntry.poolId === pool.id, "bracket now belongs to the pool");

    const membership = await prisma.membership.findUnique({
      where: { poolId_userId: { poolId: pool.id, userId: player.id } },
    });
    assert(membership !== null, "attaching enrolled the player as a pool member");

    const poolBoard = await getLeaderboard(pool.id);
    assert(
      poolBoard.some((r) => r.entryId === a.entryId),
      "attached bracket appears on the pool leaderboard",
    );

    // 3. The pooled bracket can ALSO enter the Challenge (in a pool AND the Challenge).
    await setEnteredChallenge(player.id, a.entryId, true);
    const challengeBoard = await getChallengeLeaderboard();
    assert(
      challengeBoard.some((r) => r.entryId === a.entryId),
      "pooled bracket also shows on the Challenge board",
    );
    const stillPooled = await prisma.entry.findUniqueOrThrow({
      where: { id: a.entryId },
      select: { poolId: true, enteredChallenge: true },
    });
    assert(
      stillPooled.poolId === pool.id && stillPooled.enteredChallenge,
      "bracket is in the pool AND the Challenge at once",
    );

    // 4. The second bracket is untouched — still standalone.
    gallery = await getUserBrackets(player.id, tournament.id);
    const galleryB = gallery.find((g) => g.entryId === b.entryId)!;
    assert(galleryB.placement.kind === "standalone", "the other bracket stays standalone");

    // 5. Rejection paths.
    await rejects(
      () => attachEntryToPool({ userId: player.id, entryId: a.entryId, joinCode: pool.joinCode }),
      "already in a pool",
      "attach rejects a bracket already in a pool",
    );
    await rejects(
      () => attachEntryToPool({ userId: player.id, entryId: b.entryId, joinCode: "ZZZZZZ" }),
      "no pool found",
      "attach rejects an unknown join code",
    );

    // A standalone FULL_BRACKET entry can't join a KNOCKOUT pool.
    const fullBracket = await prisma.entry.create({
      data: {
        tournamentId: tournament.id,
        poolId: null,
        format: "FULL_BRACKET",
        userId: player.id,
        label: "Full Bracket",
        importedFrom: "UI",
      },
    });
    await rejects(
      () => attachEntryToPool({ userId: player.id, entryId: fullBracket.id, joinCode: pool.joinCode }),
      "doesn't match",
      "attach rejects a format mismatch",
    );

    console.log("\nALL MULTI-BRACKET SMOKE CHECKS PASSED");
  } finally {
    await prisma.entry.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.pool.deleteMany({ where: { id: { in: poolIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
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
