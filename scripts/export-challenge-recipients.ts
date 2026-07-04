// Export the email list for the public Knockout Challenge: every verified-email
// user with an Entry where format = "KNOCKOUT" and enteredChallenge = true,
// across all pools. Mirrors the exact eligibility gate in
// lib/challenge/leaderboard.ts (getChallengeLeaderboard) minus the completeness
// check, since a recap/promo email should reach every opted-in entrant, not just
// board-eligible ones.
//
// Run with: DATABASE_URL=... npx tsx scripts/export-challenge-recipients.ts

import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";

const OUT = "ko-list.csv";

function csvField(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);

  const entries = await prisma.entry.findMany({
    where: { tournamentId, format: "KNOCKOUT", enteredChallenge: true },
    select: {
      userId: true,
      user: { select: { email: true, emailVerified: true, name: true, challengeDisplayName: true } },
    },
  });

  const byEmail = new Map<string, string>(); // email -> display name
  for (const e of entries) {
    if (!e.userId || !e.user?.emailVerified || !e.user.email) continue;
    const email = e.user.email.toLowerCase();
    const name = e.user.challengeDisplayName ?? e.user.name ?? "";
    if (!byEmail.has(email)) byEmail.set(email, name);
  }

  const rows = [...byEmail.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const csv = ["email,name", ...rows.map(([email, name]) => `${csvField(email)},${csvField(name)}`)].join("\n") + "\n";
  writeFileSync(OUT, csv, "utf8");

  console.log(`Wrote ${rows.length} recipient(s) to ${OUT}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
