// Print Knockout Challenge standings/progress (not match scores) for drafting
// the recap email: entrant count, top standings, and how many brackets are
// still perfect through the Round of 32. Read-only, safe against production.
//
// Run with: DATABASE_URL=... npx tsx scripts/challenge-progress.ts

import { prisma } from "@/lib/db";
import { getChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { asScoringConfig } from "@/lib/pool/scoring";

interface CategoryBreakdown {
  r32?: number;
  r16?: number;
  qf?: number;
  sf?: number;
  final?: number;
}

async function main() {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { scoringConfig: true },
  });
  const cfg = asScoringConfig(tournament.scoringConfig);
  const maxR32 = 16 * cfg.r32;

  const leaderboard = await getChallengeLeaderboard(DEFAULT_TOURNAMENT_SLUG);

  console.log(`=== KNOCKOUT CHALLENGE PROGRESS (${leaderboard.length} entrants) ===\n`);
  console.log("Top standings:");
  for (const row of leaderboard.slice(0, 10)) {
    const b = (row.breakdown as CategoryBreakdown | null) ?? {};
    console.log(`  #${row.rank}  ${row.label.padEnd(20)} ${String(row.total).padStart(3)} pts  (R32 ${b.r32 ?? 0}/${maxR32})`);
  }

  const perfectR32 = leaderboard.filter((row) => {
    const b = (row.breakdown as CategoryBreakdown | null) ?? {};
    return (b.r32 ?? 0) === maxR32;
  });
  console.log(`\nPerfect Round of 32 (picked all ${maxR32 / cfg.r32} winners correctly): ${perfectR32.length} entrant(s)`);
  if (perfectR32.length > 0) {
    console.log(`  ${perfectR32.map((r) => r.label).join(", ")}`);
  }

  const totalPoints = leaderboard.reduce((sum, r) => sum + r.total, 0);
  const avg = leaderboard.length > 0 ? (totalPoints / leaderboard.length).toFixed(1) : "0";
  console.log(`\nAverage score: ${avg} pts across ${leaderboard.length} entrants`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
