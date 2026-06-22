// Backend smoke test for public-challenge entry rules + sponsored prizes.
// Verifies, end-to-end on the dev DB:
//   • Knockout 2-entry cap: a 3rd opt-in for one user is rejected.
//   • Eligibility: incomplete brackets are excluded from the public board.
//   • Prize resolution: when the Final (match 104) is FINAL, exactly one PENDING
//     PrizeAward lands for the eligible rank-1 entry; a re-run is a no-op.
//   • MD3: a complete entry ranks on the public MD3 board while a partial one is
//     excluded, and finishing all 24 fixtures records a MATCH_DAY_3_PICKEM award.
//
// Mutates the wc2026 answer key + Match-73 schedule + some Result rows, then
// restores the answer key + schedule. Run with:
//   DATABASE_URL=... AUTH_SECRET=... CRON_SECRET=... npx tsx scripts/prize-smoke.ts

import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";
import { resolveR32Slots } from "@/lib/scoring/resolve";
import { resolveKnockout } from "@/lib/pool/pick-form";
import { saveSoloBracket, setEnteredChallenge } from "@/lib/challenge/solo";
import { getChallengeLeaderboard, getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { createPool, joinPool } from "@/lib/pool/manage";
import { upsertMd3Picks, getMd3Entry } from "@/lib/pool/md3-picks";
import { md3Fixtures, MD3_MATCH_NOS } from "@/lib/pool/match-day-3";
import { recomputePool } from "@/lib/pool/scoring";
import { resolveChallengePrizes } from "@/lib/challenge/prizes";

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

// A partial (incomplete) bracket: just the first R32 winner from the seed.
function partialKnockout(seed: ReturnType<typeof resolveR32Slots>): Picks {
  const picks = emptyPicks();
  picks.knockout[73] = seed[73]!.a!;
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
  const cleanupPoolIds: string[] = [];
  const touchedMatchNos = [104, ...MD3_MATCH_NOS];

  try {
    // Open the knockout field + push the R32 kickoff into the future (picks open).
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: answer as unknown as object },
    });
    await prisma.match.update({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 73 } },
      data: { scheduledAt: new Date("2030-01-01T00:00:00Z") },
    });
    const seed = resolveR32Slots(answer);
    const complete = fillKnockout(seed);
    const partial = partialKnockout(seed);

    // Clear any prior award so the run is deterministic.
    await prisma.prizeAward.deleteMany({ where: { tournamentId: tournament.id } });

    const winner = await prisma.user.upsert({
      where: { email: "prize-winner@example.com" },
      update: {},
      create: { email: "prize-winner@example.com", name: "Prize Winner" },
    });
    const capper = await prisma.user.upsert({
      where: { email: "prize-capper@example.com" },
      update: {},
      create: { email: "prize-capper@example.com", name: "Cap Tester" },
    });
    cleanupUserIds.push(winner.id, capper.id);

    // --- Knockout entry cap: capper enters 2 (incomplete) brackets, 3rd rejected ---
    const cap1 = await saveSoloBracket({ userId: capper.id, label: "Cap A", tiebreak: "1", picks: partial });
    const cap2 = await saveSoloBracket({ userId: capper.id, label: "Cap B", tiebreak: "1", picks: partial });
    const cap3 = await saveSoloBracket({ userId: capper.id, label: "Cap C", tiebreak: "1", picks: partial });

    assert((await setEnteredChallenge(capper.id, cap1.entryId, true)).ok, "1st knockout opt-in accepted");
    assert((await setEnteredChallenge(capper.id, cap2.entryId, true)).ok, "2nd knockout opt-in accepted");
    const third = await setEnteredChallenge(capper.id, cap3.entryId, true);
    assert(third.ok === false && third.capReached === true, "3rd knockout opt-in rejected (cap = 2)");

    // --- Eligibility: only complete brackets count on the board ---
    const w1 = await saveSoloBracket({ userId: winner.id, label: "Winner", tiebreak: "5", picks: complete });
    await setEnteredChallenge(winner.id, w1.entryId, true);

    const board = await getChallengeLeaderboard();
    assert(
      board.length === 1 && board[0].userId === winner.id,
      "knockout board lists only the complete entry (incomplete entered brackets excluded)",
    );
    assert(board[0].rank === 1, "the eligible entry is rank 1");

    // --- Prize not yet resolved (Final not FINAL) ---
    let res = await resolveChallengePrizes();
    const koBefore = res.find((r) => r.challenge === "KNOCKOUT")!;
    assert(koBefore.outcome === "not-complete", "no knockout prize before the Final is FINAL");

    // --- Mark the Final FINAL → resolve → one PENDING award for the winner ---
    const finalMatch = await prisma.match.findUniqueOrThrow({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 104 } },
      select: { id: true },
    });
    const finalWinnerCode = complete.knockout[104]!;
    await prisma.result.upsert({
      where: { matchId: finalMatch.id },
      update: { status: "FINAL", winnerCode: finalWinnerCode, homeScore: 1, awayScore: 0 },
      create: {
        matchId: finalMatch.id,
        status: "FINAL",
        source: "MANUAL",
        homeScore: 1,
        awayScore: 0,
        winnerCode: finalWinnerCode,
      },
    });

    res = await resolveChallengePrizes();
    assert(res.find((r) => r.challenge === "KNOCKOUT")!.outcome === "recorded", "knockout prize recorded");

    const koAward = await prisma.prizeAward.findUnique({
      where: { challenge_tournamentId: { challenge: "KNOCKOUT", tournamentId: tournament.id } },
    });
    assert(!!koAward && koAward.status === "PENDING", "knockout award is PENDING");
    assert(koAward!.userId === winner.id && koAward!.entryId === w1.entryId, "award points at the rank-1 winner");

    // --- Idempotent: re-run is a no-op ---
    res = await resolveChallengePrizes();
    assert(
      res.find((r) => r.challenge === "KNOCKOUT")!.outcome === "already-awarded",
      "re-running prize resolution is a no-op",
    );
    const koCount = await prisma.prizeAward.count({
      where: { tournamentId: tournament.id, challenge: "KNOCKOUT" },
    });
    assert(koCount === 1, "exactly one knockout award exists after re-run");

    // ============================ MD3 challenge ============================
    const mdPool = await createPool({
      userId: winner.id,
      name: "MD3 Smoke",
      displayName: "Winner",
      format: "MATCH_DAY_3_PICKEM",
    });
    cleanupPoolIds.push(mdPool.id);
    await joinPool({ userId: capper.id, joinCode: mdPool.joinCode });

    const fixtures = md3Fixtures();
    const fullScores = Object.fromEntries(fixtures.map((f) => [f.matchNo, { home: 2, away: 1 }]));
    const partialScores = Object.fromEntries(
      fixtures.slice(0, 10).map((f) => [f.matchNo, { home: 1, away: 0 }]),
    );

    await upsertMd3Picks({ poolId: mdPool.id, userId: winner.id, label: "Winner", scores: fullScores });
    await upsertMd3Picks({ poolId: mdPool.id, userId: capper.id, label: "Cap Tester", scores: partialScores });

    const mdWinnerEntry = await getMd3Entry(mdPool.id, winner.id);
    const mdCapperEntry = await getMd3Entry(mdPool.id, capper.id);
    await setEnteredChallenge(winner.id, mdWinnerEntry!.entryId, true);
    await setEnteredChallenge(capper.id, mdCapperEntry!.entryId, true);

    const mdBoard = await getMd3ChallengeLeaderboard();
    assert(
      mdBoard.length === 1 && mdBoard[0].userId === winner.id,
      "MD3 board lists only the complete (24/24) entry",
    );

    // Mark all 24 MD3 fixtures FINAL so the challenge completes.
    for (const f of fixtures) {
      const m = await prisma.match.findUniqueOrThrow({
        where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: f.matchNo } },
        select: { id: true },
      });
      await prisma.result.upsert({
        where: { matchId: m.id },
        update: {
          status: "FINAL",
          homeTeamCode: f.homeCode,
          awayTeamCode: f.awayCode,
          homeScore: 2,
          awayScore: 1,
        },
        create: {
          matchId: m.id,
          status: "FINAL",
          source: "MANUAL",
          homeTeamCode: f.homeCode,
          awayTeamCode: f.awayCode,
          homeScore: 2,
          awayScore: 1,
        },
      });
    }
    await recomputePool(mdPool.id);

    res = await resolveChallengePrizes();
    assert(
      res.find((r) => r.challenge === "MATCH_DAY_3_PICKEM")!.outcome === "recorded",
      "MD3 prize recorded once all 24 fixtures are FINAL",
    );
    const mdAward = await prisma.prizeAward.findUnique({
      where: { challenge_tournamentId: { challenge: "MATCH_DAY_3_PICKEM", tournamentId: tournament.id } },
    });
    assert(
      !!mdAward && mdAward.status === "PENDING" && mdAward.userId === winner.id,
      "MD3 award is PENDING for the complete entry",
    );

    console.log("\nAll prize-smoke assertions passed ✅");
  } finally {
    // Restore the answer key + Match-73 schedule and clean up test data.
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { officialResults: prevResults as object },
    });
    await prisma.match.update({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: 73 } },
      data: { scheduledAt: prevM73 },
    });
    // Clear the Result rows we forced FINAL so we don't leave the dev DB dirty.
    const touched = await prisma.match.findMany({
      where: { tournamentId: tournament.id, matchNo: { in: touchedMatchNos } },
      select: { id: true },
    });
    await prisma.result.deleteMany({ where: { matchId: { in: touched.map((m) => m.id) } } });
    await prisma.prizeAward.deleteMany({ where: { tournamentId: tournament.id } });
    if (cleanupPoolIds.length) {
      await prisma.entry.deleteMany({ where: { poolId: { in: cleanupPoolIds } } });
      await prisma.membership.deleteMany({ where: { poolId: { in: cleanupPoolIds } } });
      await prisma.pool.deleteMany({ where: { id: { in: cleanupPoolIds } } });
    }
    if (cleanupUserIds.length) {
      await prisma.entry.deleteMany({ where: { userId: { in: cleanupUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
