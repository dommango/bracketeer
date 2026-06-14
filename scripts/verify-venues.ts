import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const t = await prisma.tournament.findUnique({ where: { slug: "wc2026" }, select: { id: true } });
  if (!t) throw new Error("wc2026 not seeded");
  const matches = await prisma.match.findMany({
    where: { tournamentId: t.id },
    orderBy: { matchNo: "asc" },
    select: { matchNo: true, roundCode: true, homeSlotRef: true, awaySlotRef: true, venue: true, city: true },
  });
  let missing = 0;
  for (const m of matches) {
    const tag = m.venue && m.city ? `${m.venue} · ${m.city}` : "*** MISSING ***";
    if (!m.venue || !m.city) missing++;
    console.log(`#${String(m.matchNo).padStart(3)} ${m.roundCode.padEnd(6)} ${m.homeSlotRef} v ${m.awaySlotRef}  →  ${tag}`);
  }
  console.log(`\n${matches.length} matches, ${missing} missing venue/city`);
  if (missing > 0) process.exitCode = 1;
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
