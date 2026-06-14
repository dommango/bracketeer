// Seed the WC2026 tournament: one Tournament row, 48 Teams, 104 Matches, and
// the scoring config the engine reads. Idempotent — safe to re-run.
//
// Run with: npm run db:seed

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  TEAMS,
  GROUPS,
  R32,
  R16,
  QF,
  SF,
  BRONZE,
  FINAL,
  groupMatchups,
} from "../lib/scoring/data";
import { DEFAULT_SCORING } from "../lib/scoring/score";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SLUG = "wc2026";

// Parse a label like "Sat Jun 27" / "Wed Jul 1" into a 2026 UTC date.
const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseLabelDate(label: string): Date | null {
  const m = label.match(/([A-Z][a-z]{2})\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTHS[m[1]];
  if (month == null) return null;
  return new Date(Date.UTC(2026, month, Number(m[2]), 19, 0, 0));
}

function r32SlotRef(slot: (typeof R32)[number]["a"]): string {
  if ("third" in slot) return `3rd:${slot.third.join("")}`;
  return `${slot.pos}${slot.group}`;
}

interface SeedMatch {
  matchNo: number;
  roundCode: string;
  homeSlotRef: string;
  awaySlotRef: string;
  date: string | null;
}

function buildMatches(): SeedMatch[] {
  const out: SeedMatch[] = [];

  // Group matches 1–72 (12 groups × 6 pairings, in group order A–L).
  let no = 1;
  for (const letter of Object.keys(GROUPS)) {
    for (const [home, away] of groupMatchups(letter)) {
      out.push({
        matchNo: no++,
        roundCode: "GROUP",
        homeSlotRef: home,
        awaySlotRef: away,
        date: null,
      });
    }
  }

  // R32 73–88.
  for (const m of R32) {
    out.push({
      matchNo: m.id,
      roundCode: "R32",
      homeSlotRef: r32SlotRef(m.a),
      awaySlotRef: r32SlotRef(m.b),
      date: m.date,
    });
  }
  // R16 / QF / SF — feeders are "W<id>".
  for (const [round, list] of [["R16", R16], ["QF", QF], ["SF", SF]] as const) {
    for (const m of list) {
      out.push({
        matchNo: m.id,
        roundCode: round,
        homeSlotRef: `W${m.a}`,
        awaySlotRef: `W${m.b}`,
        date: m.date,
      });
    }
  }
  // Bronze 103 — losers of the semifinals.
  out.push({
    matchNo: BRONZE.id,
    roundCode: "BRONZE",
    homeSlotRef: `L${BRONZE.aLoser}`,
    awaySlotRef: `L${BRONZE.bLoser}`,
    date: BRONZE.date,
  });
  // Final 104.
  out.push({
    matchNo: FINAL.id,
    roundCode: "FINAL",
    homeSlotRef: `W${FINAL.a}`,
    awaySlotRef: `W${FINAL.b}`,
    date: FINAL.date,
  });

  return out;
}

async function main() {
  const tournament = await prisma.tournament.upsert({
    where: { slug: SLUG },
    update: {
      name: "FIFA World Cup 2026",
      sport: "football",
      startsAt: new Date(Date.UTC(2026, 5, 11, 19, 0, 0)),
      scoringConfig: DEFAULT_SCORING,
    },
    create: {
      slug: SLUG,
      name: "FIFA World Cup 2026",
      sport: "football",
      startsAt: new Date(Date.UTC(2026, 5, 11, 19, 0, 0)),
      scoringConfig: DEFAULT_SCORING,
    },
  });

  // Teams.
  for (const [g, codes] of Object.entries(GROUPS)) {
    for (const code of codes) {
      await prisma.team.upsert({
        where: { tournamentId_code: { tournamentId: tournament.id, code } },
        update: { name: TEAMS[code], group: g },
        create: { tournamentId: tournament.id, code, name: TEAMS[code], group: g },
      });
    }
  }

  // Matches.
  const matches = buildMatches();
  for (const sm of matches) {
    await prisma.match.upsert({
      where: { tournamentId_matchNo: { tournamentId: tournament.id, matchNo: sm.matchNo } },
      update: {
        roundCode: sm.roundCode,
        homeSlotRef: sm.homeSlotRef,
        awaySlotRef: sm.awaySlotRef,
        scheduledAt: sm.date ? parseLabelDate(sm.date) : null,
      },
      create: {
        tournamentId: tournament.id,
        matchNo: sm.matchNo,
        roundCode: sm.roundCode,
        homeSlotRef: sm.homeSlotRef,
        awaySlotRef: sm.awaySlotRef,
        scheduledAt: sm.date ? parseLabelDate(sm.date) : null,
      },
    });
  }

  const teamCount = await prisma.team.count({ where: { tournamentId: tournament.id } });
  const matchCount = await prisma.match.count({ where: { tournamentId: tournament.id } });
  console.log(`Seeded ${tournament.slug}: ${teamCount} teams, ${matchCount} matches.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
