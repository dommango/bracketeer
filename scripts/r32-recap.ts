// Print a Round of 32 recap (score, date, penalty shootouts) plus whichever
// Round of 16 matchups are now set, for drafting the post-R32 recap email.
// Read-only — no writes, safe to run against production.
//
// Run with: DATABASE_URL=... npx tsx scripts/r32-recap.ts

import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { asResults } from "@/lib/pool/scoring";
import { resolveBracket } from "@/lib/pool/bracket";
import { TEAMS } from "@/lib/scoring/data";
import type { TeamCode } from "@/lib/scoring/types";

function teamName(code: string | null): string {
  if (!code) return "TBD";
  return TEAMS[code as TeamCode] ?? code;
}

async function main() {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { officialResults: true },
  });
  const resolved = resolveBracket(asResults(tournament.officialResults));

  const r32Matches = await prisma.match.findMany({
    where: { tournamentId, roundCode: "R32" },
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

  console.log("=== ROUND OF 32 RECAP ===\n");
  for (const m of r32Matches) {
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

  console.log("\n=== ROUND OF 16 MATCHUPS ===\n");
  for (let id = 89; id <= 96; id++) {
    const rm = resolved[id];
    if (!rm) continue;
    console.log(`M${id}: ${teamName(rm.home)} vs ${teamName(rm.away)}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
