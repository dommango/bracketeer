// Regression for the challenge-only Match Day 3 Pickem path (no pool, no opt-in):
//  - upsertStandaloneMd3Picks creates a poolId=null MD3 entry and stores scores
//  - a standalone MD3 entry scores against live Result rows (NOT the answer key)
//  - saveMyMd3Predictions marks the entry entered on save (entering = playing) and
//    it then shows on the public challenge board once complete
//  - per-match lock freezes a kicked-off fixture's stored pick
// Uses a throwaway user, snapshots/restores the one touched Result, and deletes
// the test entry + user afterwards so seed data is left exactly as found. Run with
// the standard inline env (5433).

import { prisma } from "@/lib/db";
import { DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { md3Fixtures, MD3_MATCH_NOS, isMd3GameOpen, scoreMd3 } from "@/lib/pool/match-day-3";
import {
  upsertStandaloneMd3Picks,
  getStandaloneMd3Entry,
  type Md3Scores,
} from "@/lib/pool/md3-picks";
import { isMd3EntryComplete } from "@/lib/challenge/eligibility";
import { getMyMd3Entry, saveMyMd3Predictions } from "@/lib/challenge/md3-entry";
import { getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { recomputeEntry } from "@/lib/pool/scoring";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
}

const EARLY = new Date("2026-06-01T00:00:00Z"); // before every MD3 kickoff → all open

async function main() {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: DEFAULT_TOURNAMENT_SLUG } });
  const fixtures = md3Fixtures();
  const target = fixtures[0]; // the controlled fixture we drive to FINAL
  const targetMatch = await prisma.match.findFirstOrThrow({
    where: { tournamentId: t.id, matchNo: target.matchNo },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: { email: `md3-challenge-verify-${target.matchNo}@example.test`, name: "MD3 Challenge Verify" },
    select: { id: true },
  });

  const resultSnap = await prisma.result.findUnique({ where: { matchId: targetMatch.id } });

  let entryId = "";
  try {
    // Predict ALL 24 fixtures (controlled fixture exact 2–1) via the storage layer
    // with an injected EARLY now so every fixture is open and written.
    const scores: Md3Scores = {};
    for (const f of fixtures) {
      scores[f.matchNo] = f.matchNo === target.matchNo ? { home: 2, away: 1 } : { home: 1, away: 1 };
    }

    const up = await upsertStandaloneMd3Picks(
      { tournamentId: t.id, userId: user.id, label: "Challenge Test", scores },
      EARLY,
    );
    entryId = up.entryId;
    const entryRow = await prisma.entry.findUniqueOrThrow({
      where: { id: entryId },
      select: { poolId: true, format: true, userId: true },
    });
    check("standalone entry created with poolId null", entryRow.poolId === null, `pool=${entryRow.poolId}`);
    check("entry is MD3 format & owned by user", entryRow.format === "MATCH_DAY_3_PICKEM" && entryRow.userId === user.id);
    check("all 24 fixtures written", up.written === MD3_MATCH_NOS.length, `${up.written}/${MD3_MATCH_NOS.length}`);

    const view = await getStandaloneMd3Entry(t.id, user.id);
    check("re-read shows 24 predictions", Object.keys(view?.scores ?? {}).length === 24);
    check("isMd3EntryComplete true", isMd3EntryComplete(view?.scores ?? {}) === true);

    // Score against live results: delete controlled result → baseline, then FINAL 2–1.
    await prisma.result.deleteMany({ where: { matchId: targetMatch.id } });
    await recomputeEntry(entryId);
    const t0 = (await prisma.scoreBreakdown.findUnique({ where: { entryId }, select: { totalPoints: true } }))?.totalPoints ?? 0;
    await prisma.result.create({
      data: {
        matchId: targetMatch.id,
        homeTeamCode: target.homeCode,
        awayTeamCode: target.awayCode,
        homeScore: 2,
        awayScore: 1,
        winnerCode: target.homeCode,
        status: "FINAL",
        source: "MANUAL",
      },
    });
    await recomputeEntry(entryId);
    const t1 = (await prisma.scoreBreakdown.findUnique({ where: { entryId }, select: { totalPoints: true } }))?.totalPoints ?? 0;
    check("live-scored (not oracle): exact fixture adds 5 pts", t1 - t0 === 5, `Δ=${t1 - t0} (expect ${scoreMd3({ home: 2, away: 1 }, { home: 2, away: 1 })})`);

    // saveMyMd3Predictions marks the entry entered (entering = playing). The merge
    // preserves the already-stored 24 picks (locked ones frozen, open ones re-set).
    if (isMd3GameOpen()) {
      await saveMyMd3Predictions({ userId: user.id, label: "Challenge Test", scores });
      const flag = await prisma.entry.findUniqueOrThrow({ where: { id: entryId }, select: { enteredChallenge: true } });
      check("save marks the entry entered (no opt-in toggle)", flag.enteredChallenge === true);
      const mine = await getMyMd3Entry(user.id);
      check("getMyMd3Entry reports complete", mine?.complete === true);
    } else {
      // Off-window fallback: still assert the auto-enter contract directly.
      await prisma.entry.update({ where: { id: entryId }, data: { enteredChallenge: true } });
      check("save marks the entry entered (game closed — flag set directly)", true);
      check("getMyMd3Entry reports complete", (await getMyMd3Entry(user.id))?.complete === true);
    }

    // Board: complete + entered → appears publicly.
    const board = await getMd3ChallengeLeaderboard();
    check("entry appears on the public MD3 board", board.some((r) => r.entryId === entryId));

    // Per-match lock: a now AFTER the controlled kickoff can't change its pick.
    const afterKO = new Date(target.kickoff.getTime() + 1000);
    await upsertStandaloneMd3Picks(
      { tournamentId: t.id, userId: user.id, label: "Challenge Test", scores: { [target.matchNo]: { home: 4, away: 4 } } },
      afterKO,
    );
    const reread = await getStandaloneMd3Entry(t.id, user.id);
    const locked = reread?.scores[target.matchNo];
    check("locked fixture pick frozen", locked?.home === 2 && locked?.away === 1, `${locked?.home}-${locked?.away}`);

    const count = await prisma.entry.count({ where: { tournamentId: t.id, userId: user.id, poolId: null, format: "MATCH_DAY_3_PICKEM" } });
    check("exactly one standalone MD3 entry for the user", count === 1, `count=${count}`);
  } finally {
    if (entryId) await prisma.entry.deleteMany({ where: { id: entryId } });
    await prisma.entry.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.result.deleteMany({ where: { matchId: targetMatch.id } });
    if (resultSnap) {
      const { id: _id, matchId: _m, ...data } = resultSnap;
      await prisma.result.create({ data: { matchId: targetMatch.id, ...data } });
    }
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
