// Demo data for a clickable Match Day Pickem walkthrough. Match Day Pickem is a
// public challenge (no pool): this seeds a handful of standalone challenge entries
// (varied scoreline picks + 6 finished matches) plus a knockout pool so the
// signed-in multi-pool hub still shows for the demo owner. Run once against a
// freshly-seeded WC2026 DB.
import { prisma } from "@/lib/db";
import { createPool } from "@/lib/pool/manage";
import { upsertStandaloneMd3Picks, type Md3Scores } from "@/lib/pool/md3-picks";
import { recomputeStandalone } from "@/lib/pool/scoring";
import { getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { md3Fixtures } from "@/lib/pool/match-day-3";
import { DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";

type Line = { home: number; away: number };

const NOW = new Date("2026-06-22T00:00:00Z"); // all 24 MD3 fixtures still open

// 6 finished matches (canonical home–away) + each player's predictions for them.
const ACTUALS: Line[] = [
  { home: 2, away: 1 },
  { home: 0, away: 0 },
  { home: 1, away: 2 },
  { home: 3, away: 1 },
  { home: 1, away: 1 },
  { home: 2, away: 0 },
];

const PLAYERS: { email: string; name: string; played: Line[] }[] = [
  {
    email: "dommango@gmail.com",
    name: "Dom",
    played: [
      { home: 2, away: 1 }, { home: 0, away: 0 }, { home: 1, away: 2 },
      { home: 2, away: 1 }, { home: 1, away: 1 }, { home: 1, away: 0 },
    ],
  },
  {
    email: "sofia.demo@example.com",
    name: "Sofia",
    played: [
      { home: 1, away: 0 }, { home: 1, away: 1 }, { home: 0, away: 1 },
      { home: 3, away: 1 }, { home: 0, away: 0 }, { home: 2, away: 1 },
    ],
  },
  {
    email: "marcus.demo@example.com",
    name: "Marcus",
    played: [
      { home: 2, away: 0 }, { home: 0, away: 0 }, { home: 1, away: 2 },
      { home: 1, away: 0 }, { home: 2, away: 2 }, { home: 2, away: 0 },
    ],
  },
  {
    email: "priya.demo@example.com",
    name: "Priya",
    played: [
      { home: 3, away: 1 }, { home: 2, away: 2 }, { home: 2, away: 3 },
      { home: 3, away: 2 }, { home: 1, away: 1 }, { home: 1, away: 1 },
    ],
  },
];

async function ensureUser(email: string, name: string): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
    select: { id: true },
  });
  return u.id;
}

function scoresFor(played: Line[], fixtureCount: number): Md3Scores {
  const fixtures = md3Fixtures();
  const out: Md3Scores = {};
  fixtures.forEach((f, i) => {
    out[f.matchNo] = i < played.length ? played[i] : { home: 1, away: 0 };
  });
  void fixtureCount;
  return out;
}

async function main() {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: DEFAULT_TOURNAMENT_SLUG } });
  const fixtures = md3Fixtures();

  // Users
  const ids: Record<string, string> = {};
  for (const p of PLAYERS) ids[p.email] = await ensureUser(p.email, p.name);
  const ownerId = ids["dommango@gmail.com"];

  // Everyone's Match Day Pickem challenge entries (standalone, no pool), entered.
  for (const p of PLAYERS) {
    const { entryId } = await upsertStandaloneMd3Picks(
      { tournamentId: t.id, userId: ids[p.email], label: p.name, scores: scoresFor(p.played, fixtures.length) },
      NOW,
    );
    await prisma.entry.update({ where: { id: entryId }, data: { enteredChallenge: true } });
  }

  // 6 finished matches (FINAL Result rows)
  for (let i = 0; i < ACTUALS.length; i++) {
    const f = fixtures[i];
    const match = await prisma.match.findFirstOrThrow({
      where: { tournamentId: t.id, matchNo: f.matchNo },
    });
    await prisma.result.upsert({
      where: { matchId: match.id },
      update: {
        homeTeamCode: f.homeCode, awayTeamCode: f.awayCode,
        homeScore: ACTUALS[i].home, awayScore: ACTUALS[i].away,
        status: "FINAL", source: "API",
      },
      create: {
        matchId: match.id,
        homeTeamCode: f.homeCode, awayTeamCode: f.awayCode,
        homeScore: ACTUALS[i].home, awayScore: ACTUALS[i].away,
        status: "FINAL", source: "API",
      },
    });
  }

  await recomputeStandalone(t.id);

  // A pool so Dom's hub lists one (knockout is creatable post-kickoff)
  const ko = await createPool({
    userId: ownerId,
    name: "Last 32 Bracket Battle",
    displayName: "Dom",
    format: "KNOCKOUT",
  });

  const board = await getMd3ChallengeLeaderboard();

  console.log("\n=== Demo ready ===");
  console.log(`MD3 challenge : /challenge/md3  (play at /challenge/md3/play)`);
  console.log(`Knockout pool : ${ko.joinCode}   →  /pool/${ko.joinCode}`);
  console.log("Owner login: dommango@gmail.com (magic link prints to the dev server console)");
  console.log("\nMatch Day Pickem board (6 of 24 matches final):");
  for (const e of board) console.log(`  ${e.label.padEnd(8)} ${e.total} pts`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
