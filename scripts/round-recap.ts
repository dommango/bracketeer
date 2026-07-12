// Print a knockout-round recap for drafting the post-round update email:
// (1) that round's scorelines (flagging penalty shootouts), (2) whichever
// next-round matchups are now set, and (3) Knockout Challenge standings/progress.
// Generalizes scripts/r32-recap.ts to any round and folds in the standings block
// from scripts/challenge-progress.ts. Read-only — no writes, safe against production.
//
// Run with: DATABASE_URL=... npx tsx scripts/round-recap.ts [ROUND]
//   ROUND is one of R32 | R16 | QF | SF | FINAL (default QF).

import { prisma } from "@/lib/db";
import { getChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { asResults, asScoringConfig } from "@/lib/pool/scoring";
import { resolveBracket } from "@/lib/pool/bracket";
import { TEAMS } from "@/lib/scoring/data";
import type { TeamCode } from "@/lib/scoring/types";

type Round = "R32" | "R16" | "QF" | "SF" | "FINAL";

// Per round: the roundCode to pull results for, and the match ids of the round it
// feeds (empty for FINAL). SF feeds the bronze match (103) plus the final (104).
const NEXT_MATCHUPS: Record<Round, { label: string; ids: number[] }> = {
  R32: { label: "ROUND OF 16", ids: [89, 90, 91, 92, 93, 94, 95, 96] },
  R16: { label: "QUARTERFINALS", ids: [97, 98, 99, 100] },
  QF: { label: "SEMIFINALS", ids: [101, 102] },
  SF: { label: "FINAL", ids: [103, 104] },
  FINAL: { label: "", ids: [] },
};

interface CategoryBreakdown {
  r32?: number;
  r16?: number;
  qf?: number;
  sf?: number;
  final?: number;
}

function teamName(code: string | null): string {
  if (!code) return "TBD";
  return TEAMS[code as TeamCode] ?? code;
}

function parseRound(arg: string | undefined): Round {
  const round = (arg ?? "QF").toUpperCase();
  if (round in NEXT_MATCHUPS) return round as Round;
  throw new Error(`Unknown round "${arg}". Use one of: ${Object.keys(NEXT_MATCHUPS).join(", ")}`);
}

async function main() {
  const round = parseRound(process.argv[2]);
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true, scoringConfig: true },
  });
  const resolved = resolveBracket(asResults(tournament.officialResults));

  // --- 1. Round results ---
  const matches = await prisma.match.findMany({
    where: { tournamentId, roundCode: round },
    orderBy: { matchNo: "asc" },
    select: {
      matchNo: true,
      scheduledAt: true,
      venue: true,
      city: true,
      result: {
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          homeScore: true,
          awayScore: true,
          homePens: true,
          awayPens: true,
          winnerCode: true,
          status: true,
        },
      },
    },
  });

  console.log(`=== ${round} RECAP ===\n`);
  for (const m of matches) {
    const r = m.result;
    if (!r || r.status !== "FINAL") {
      console.log(`M${m.matchNo}: not final (status=${r?.status ?? "none"})`);
      continue;
    }
    const home = teamName(r.homeTeamCode);
    const away = teamName(r.awayTeamCode);
    const score = `${r.homeScore}-${r.awayScore}`;
    const pens = r.homePens != null && r.awayPens != null ? ` (pens ${r.homePens}-${r.awayPens})` : "";
    const winner = teamName(r.winnerCode);
    const dramatic = pens ? " ⚡ PENALTIES" : "";
    console.log(
      `M${m.matchNo} [${m.scheduledAt?.toISOString().slice(0, 10) ?? "?"}] ${home} ${score} ${away}${pens} — ${winner} win${dramatic}`,
    );
  }

  // --- 2. Next-round matchups ---
  const next = NEXT_MATCHUPS[round];
  if (next.ids.length > 0) {
    console.log(`\n=== ${next.label} MATCHUPS ===\n`);
    for (const id of next.ids) {
      const rm = resolved[id];
      if (!rm) continue;
      console.log(`M${id}: ${teamName(rm.home)} vs ${teamName(rm.away)}`);
    }
  }

  // --- 3. Knockout Challenge standings/progress ---
  const cfg = asScoringConfig(tournament.scoringConfig);
  const maxR32 = 16 * cfg.r32;
  const leaderboard = await getChallengeLeaderboard(DEFAULT_TOURNAMENT_SLUG);

  console.log(`\n=== KNOCKOUT CHALLENGE PROGRESS (${leaderboard.length} entrants) ===\n`);
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
