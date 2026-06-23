// Regression for the result-regression guard in upsertGroupMatchResultFromApi
// (lib/pool/results.ts): once a group match is FINAL a later poll must not flip it
// back to LIVE, and a partial payload with null scores must not clobber a stored
// real score. Snapshots the touched matches' Result rows and restores them after,
// so seeded data is left exactly as found. Run with the standard inline env (5433).

import { prisma } from "@/lib/db";
import { upsertGroupMatchResultFromApi } from "@/lib/pool/results";
import { DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  (cond ? pass++ : fail++);
  console.log(`  ${cond ? "✓" : "✗"} ${label}${detail ? `  — ${detail}` : ""}`);
}

async function snapshot(matchId: string) {
  const [result, match] = await Promise.all([
    prisma.result.findUnique({ where: { matchId } }),
    prisma.match.findUnique({ where: { id: matchId }, select: { scored: true } }),
  ]);
  return { result, scored: match?.scored ?? false };
}

async function restore(matchId: string, snap: Awaited<ReturnType<typeof snapshot>>) {
  await prisma.result.deleteMany({ where: { matchId } });
  if (snap.result) {
    const { id: _id, matchId: _m, ...data } = snap.result;
    await prisma.result.create({ data: { matchId, ...data } });
  }
  await prisma.match.update({ where: { id: matchId }, data: { scored: snap.scored } });
}

async function main() {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: DEFAULT_TOURNAMENT_SLUG } });

  // Two late group matches to avoid disturbing earlier seeded fixtures.
  const finalMatch = await prisma.match.findFirstOrThrow({
    where: { tournamentId: t.id, matchNo: 71 }, select: { id: true, homeSlotRef: true, awaySlotRef: true },
  });
  const liveMatch = await prisma.match.findFirstOrThrow({
    where: { tournamentId: t.id, matchNo: 72 }, select: { id: true, homeSlotRef: true, awaySlotRef: true },
  });
  const snapA = await snapshot(finalMatch.id);
  const snapB = await snapshot(liveMatch.id);

  try {
    const hcA = finalMatch.homeSlotRef ?? "AAA";
    const acA = finalMatch.awaySlotRef ?? "BBB";

    // 1) Drive match 71 to FINAL 2–1.
    await prisma.result.deleteMany({ where: { matchId: finalMatch.id } });
    await upsertGroupMatchResultFromApi(t.id, 71, {
      homeCode: hcA, awayCode: acA, homeScore: 2, awayScore: 1, live: false, finished: true,
    });
    let r = await prisma.result.findUniqueOrThrow({ where: { matchId: finalMatch.id } });
    check("match reaches FINAL 2-1", r.status === "FINAL" && r.homeScore === 2 && r.awayScore === 1, `${r.status} ${r.homeScore}-${r.awayScore}`);

    // 2) A later poll reports it LIVE with null scores → must be ignored.
    const res = await upsertGroupMatchResultFromApi(t.id, 71, {
      homeCode: hcA, awayCode: acA, homeScore: null, awayScore: null, live: true, finished: false,
    });
    r = await prisma.result.findUniqueOrThrow({ where: { matchId: finalMatch.id } });
    const m = await prisma.match.findUniqueOrThrow({ where: { id: finalMatch.id }, select: { scored: true } });
    check("FINAL not regressed to LIVE", r.status === "FINAL", r.status);
    check("scores not wiped", r.homeScore === 2 && r.awayScore === 1, `${r.homeScore}-${r.awayScore}`);
    check("match stays scored", m.scored === true);
    check("upsert reported not-applied", res.applied === false);

    // 3) Null-score clobber guard on a still-LIVE match: 1–0 live, then null live.
    const hcB = liveMatch.homeSlotRef ?? "CCC";
    const acB = liveMatch.awaySlotRef ?? "DDD";
    await prisma.result.deleteMany({ where: { matchId: liveMatch.id } });
    await upsertGroupMatchResultFromApi(t.id, 72, {
      homeCode: hcB, awayCode: acB, homeScore: 1, awayScore: 0, live: true, finished: false,
    });
    await upsertGroupMatchResultFromApi(t.id, 72, {
      homeCode: hcB, awayCode: acB, homeScore: null, awayScore: null, live: true, finished: false,
    });
    const rb = await prisma.result.findUniqueOrThrow({ where: { matchId: liveMatch.id } });
    check("LIVE real score not clobbered by null payload", rb.homeScore === 1 && rb.awayScore === 0, `${rb.homeScore}-${rb.awayScore}`);
  } finally {
    await restore(finalMatch.id, snapA);
    await restore(liveMatch.id, snapB);
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
