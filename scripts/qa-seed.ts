// Production-scale, sanitized QA dataset. Builds a realistic spread of pools,
// members, brackets, picks, results, chat and feedback so every user-facing
// feature can be exercised at scale. Everything is synthetic (@seed.test emails,
// invented names) — no real PII.
//
// Idempotent: re-running upserts users, reuses pools by join code, and replaces
// entries in place (importSubmission/upsertMd3Picks are keyed). The tournament's
// prior officialResults is backed up to a JSON file before the answer key is set.
//
// Run with the standard inline-env prefix, e.g.:
//   env DATABASE_URL=... AUTH_SECRET=... CRON_SECRET=... APP_BASE_URL=... \
//     npx tsx scripts/qa-seed.ts
//
// Pools created (all against the seeded WC2026 tournament):
//   HESSQA  FULL_BRACKET / PREMIUM   ~32 brackets (full + partial + messy)
//   FREECAP FULL_BRACKET / FREE      filled to the 20-member cap (+ cap probe)
//   KOQA    KNOCKOUT                 ~16 knockout-only brackets
//   MD3QA   MATCH_DAY_3_PICKEM       ~14 score-prediction entries

import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { GROUPS, R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";
import { emptyPicks, type Results, type Submission } from "@/lib/scoring/types";
import { importSubmission } from "@/lib/pool/import";
import { upsertMd3Picks, type Md3Scores } from "@/lib/pool/md3-picks";
import { md3Fixtures } from "@/lib/pool/match-day-3";
import { joinPool } from "@/lib/pool/manage";
import { recomputePool } from "@/lib/pool/scoring";
import { POOL_FULL_MESSAGE, FREE_MEMBER_CAP } from "@/lib/billing/entitlements";
import { DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";

const groups = Object.keys(GROUPS);
const knockoutMatches = [...R32, ...R16, ...QF, ...SF, FINAL];
const favorites = ["BRA", "ARG", "FRA", "ESP", "ENG", "POR", "GER", "NED"];

// Deterministic RNG so reruns produce the same dataset.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Synthetic people -------------------------------------------------------
const FIRST = [
  "Avery", "Bjorn", "Camila", "Dario", "Esme", "Fionn", "Greta", "Hassan",
  "Ines", "Jamal", "Kaito", "Lena", "Mateo", "Noor", "Otis", "Priya",
  "Quinn", "Rafa", "Sena", "Tariq", "Uma", "Viggo", "Wren", "Xiomara",
  "Yara", "Zane", "Anouk", "Beto", "Cleo", "Dewi", "Eitan", "Faye",
  "Goran", "Hina", "Ivo", "Juno", "Kemal", "Liv", "Mira", "Nael",
];
const LAST = [
  "Adeyemi", "Bauer", "Costa", "Duval", "Eriksson", "Ferreira", "Gomez",
  "Haddad", "Ito", "Jovic", "Khan", "Larsson", "Mensah", "Novak", "Okafor",
  "Park", "Quintero", "Rossi", "Singh", "Tran", " Universe".trim(), "Vega",
  "Wallace", "Xu", "Yilmaz", "Zima", "Brandt", "Cho", "Dlamini", "Engel",
];

interface Person {
  name: string;
  email: string;
  chalk: number; // 1 = always favorites, 0 = chaos
  tiebreak: string;
  seed: number;
}

function makePeople(count: number, startSeed: number): Person[] {
  const out: Person[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(startSeed + i * 101);
    const first = FIRST[Math.floor(rng() * FIRST.length)];
    const last = LAST[Math.floor(rng() * LAST.length)];
    const name = `${first} ${last}`;
    // Unique, stable, sanitized email.
    const email = `${first}.${last}.${startSeed + i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@seed.test";
    out.push({
      name,
      email,
      chalk: Math.round(rng() * 100) / 100,
      tiebreak: String(1 + Math.floor(rng() * 6)),
      seed: startSeed + i,
    });
  }
  return out;
}

// --- Bracket builder (favorites-biased, with partials) ----------------------
function buildPicks(rng: () => number, chalk: number, partial = false): Submission["picks"] {
  const p = emptyPicks();
  for (const g of groups) {
    const teams = GROUPS[g];
    const first = rng() < chalk ? teams[0] : teams[Math.floor(rng() * teams.length)];
    let second = rng() < chalk ? teams[1] : teams[Math.floor(rng() * teams.length)];
    if (second === first) second = teams[(teams.indexOf(first) + 1) % teams.length];
    p.groupFirst[g] = first;
    if (!(partial && rng() < 0.25)) p.groupSecond[g] = second;
  }
  const candidates: string[] = [];
  for (const g of groups) {
    const taken = new Set([p.groupFirst[g], p.groupSecond[g]]);
    for (const t of GROUPS[g]) if (!taken.has(t)) candidates.push(t);
  }
  const scored = candidates.map((t) => {
    const g = groups.find((gg) => GROUPS[gg].includes(t))!;
    return { t, score: GROUPS[g].indexOf(t) + (1 - chalk) * rng() * 4 };
  });
  scored.sort((a, b) => a.score - b.score);
  p.thirdAdvance = scored.slice(0, partial ? 4 + Math.floor(rng() * 5) : 8).map((s) => s.t);

  for (const m of knockoutMatches) {
    if (partial && rng() < 0.3) continue;
    const poolTeams = rng() < chalk ? favorites : groups.map((g) => GROUPS[g][Math.floor(rng() * 4)]);
    p.knockout[m.id] = poolTeams[Math.floor(rng() * poolTeams.length)];
  }

  const players = ["Lamine Yamal", "Vinicius Jr", "Jude Bellingham", "Kylian Mbappe", "Pedri"];
  const youngsters = ["Lamine Yamal", "Endrick", "Arda Guler", "Warren Zaire-Emery"];
  const boots = ["Kylian Mbappe", "Harry Kane", "Vinicius Jr", "Julian Alvarez"];
  p.awards.player = players[Math.floor(rng() * players.length)];
  p.awards.young = youngsters[Math.floor(rng() * youngsters.length)];
  p.awards.boot = boots[Math.floor(rng() * boots.length)];
  p.awards.goal = rng() < 0.4 ? "Worldie from 30 yards" : "";
  return p;
}

// Knockout-only picks: groups/thirds empty, just winners + awards (what a real
// knockout entry owns).
function buildKnockoutPicks(rng: () => number, chalk: number): Submission["picks"] {
  const p = emptyPicks();
  for (const m of knockoutMatches) {
    const poolTeams = rng() < chalk ? favorites : groups.map((g) => GROUPS[g][Math.floor(rng() * 4)]);
    p.knockout[m.id] = poolTeams[Math.floor(rng() * poolTeams.length)];
  }
  p.awards.player = "Lamine Yamal";
  p.awards.boot = rng() < 0.5 ? "Kylian Mbappe" : "Harry Kane";
  return p;
}

// --- Answer key (complete chalk so every scoring tier is exercised) ---------
function chalkAnswerKey(): Results {
  return {
    ...emptyPicks(),
    groupFirst: Object.fromEntries(groups.map((g) => [g, GROUPS[g][0]])),
    groupSecond: Object.fromEntries(groups.map((g) => [g, GROUPS[g][1]])),
    thirdAdvance: ["BRA", "ARG", "FRA", "ESP", "ENG", "POR", "GER", "NED"],
    knockout: Object.fromEntries(
      knockoutMatches.map((m, i) => [m.id, favorites[i % favorites.length]]),
    ),
    awards: { player: "Lamine Yamal", young: "Lamine Yamal", boot: "Kylian Mbappe", goal: "" },
    finalGoals: 3,
  };
}

async function ensureUser(p: Person): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email: p.email },
    update: { name: p.name },
    create: { email: p.email, name: p.name },
    select: { id: true },
  });
  return u.id;
}

async function ensurePool(opts: {
  joinCode: string;
  name: string;
  ownerId: string;
  format: "FULL_BRACKET" | "KNOCKOUT" | "MATCH_DAY_3_PICKEM";
  tier: "FREE" | "PREMIUM";
  ownerDisplay: string;
}): Promise<string> {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { slug: DEFAULT_TOURNAMENT_SLUG },
    select: { id: true },
  });
  const existing = await prisma.pool.findUnique({ where: { joinCode: opts.joinCode }, select: { id: true } });
  if (existing) {
    await prisma.pool.update({ where: { id: existing.id }, data: { format: opts.format, tier: opts.tier, name: opts.name } });
    await prisma.membership.upsert({
      where: { poolId_userId: { poolId: existing.id, userId: opts.ownerId } },
      update: { role: "OWNER", displayName: opts.ownerDisplay },
      create: { poolId: existing.id, userId: opts.ownerId, role: "OWNER", displayName: opts.ownerDisplay },
    });
    return existing.id;
  }
  // Direct insert: createPool() time-gates FULL_BRACKET/MD3 by date, which we
  // intentionally bypass for seeding (seeding is not a user action).
  const pool = await prisma.pool.create({
    data: {
      tournamentId: tournament.id,
      name: opts.name,
      ownerId: opts.ownerId,
      joinCode: opts.joinCode,
      format: opts.format,
      tier: opts.tier,
      memberships: { create: { userId: opts.ownerId, role: "OWNER", displayName: opts.ownerDisplay } },
    },
    select: { id: true },
  });
  return pool.id;
}

async function addMember(poolId: string, userId: string, displayName: string, role: "MEMBER" | "OWNER" = "MEMBER") {
  await prisma.membership.upsert({
    where: { poolId_userId: { poolId, userId } },
    update: {},
    create: { poolId, userId, displayName, role },
  });
}

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { slug: DEFAULT_TOURNAMENT_SLUG } });

  // 1) Back up + set the answer key.
  const backupPath = "/home/dom/.claude/jobs/64619b0c/tmp/officialResults.backup.json";
  writeFileSync(backupPath, JSON.stringify(tournament.officialResults ?? null, null, 2));
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { officialResults: chalkAnswerKey() as unknown as object },
  });
  console.log(`Answer key set (prior value backed up to ${backupPath}).`);

  // 2) Owner.
  const owner: Person = { name: "Dom Mango", email: "dommango@gmail.com", chalk: 0.85, tiebreak: "3", seed: 1 };
  const ownerId = await prisma.user.upsert({
    where: { email: owner.email },
    update: {},
    create: { email: owner.email, name: owner.name },
    select: { id: true },
  }).then((u) => u.id);

  // 3) HESSQA — full bracket, PREMIUM, ~32 brackets.
  const hessId = await ensurePool({ joinCode: "HESSQA", name: "HessFest QA League", ownerId, format: "FULL_BRACKET", tier: "PREMIUM", ownerDisplay: "Dom" });
  const fullPeople = makePeople(31, 1000);
  // Owner's own bracket.
  await importSubmission(hessId, { contestant: { name: owner.name, email: owner.email, tiebreak: owner.tiebreak }, picks: buildPicks(mulberry32(7919), owner.chalk) });
  for (let i = 0; i < fullPeople.length; i++) {
    const p = fullPeople[i];
    const uid = await ensureUser(p);
    await addMember(hessId, uid, p.name.split(" ")[0]);
    const partial = i % 7 === 0; // ~1 in 7 is a partial bracket
    await importSubmission(hessId, {
      contestant: { name: p.name, email: p.email, tiebreak: p.tiebreak },
      picks: buildPicks(mulberry32(p.seed * 7919), p.chalk, partial),
    });
  }

  // 4) FREECAP — FREE, fill to the cap, then probe the cap.
  const capId = await ensurePool({ joinCode: "FREEPL", name: "Office Free Pool", ownerId, format: "FULL_BRACKET", tier: "FREE", ownerDisplay: "Dom" });
  const capPeople = makePeople(FREE_MEMBER_CAP + 4, 2000);
  let joined = 1; // owner counts
  let capProbe = "not reached";
  for (const p of capPeople) {
    const uid = await ensureUser(p);
    try {
      await joinPool({ userId: uid, joinCode: "FREEPL", displayName: p.name.split(" ")[0] });
      joined++;
    } catch (e) {
      capProbe = (e as Error).message;
      if (capProbe === POOL_FULL_MESSAGE) break;
      throw e;
    }
  }

  // 5) KOQA — knockout-only, ~16 brackets.
  const koId = await ensurePool({ joinCode: "KNOCKO", name: "Last 32 Knockout Battle", ownerId, format: "KNOCKOUT", tier: "FREE", ownerDisplay: "Dom" });
  const koPeople = makePeople(15, 3000);
  await importSubmission(koId, { contestant: { name: owner.name, email: owner.email, tiebreak: "2" }, picks: buildKnockoutPicks(mulberry32(111), 0.8) });
  for (const p of koPeople) {
    const uid = await ensureUser(p);
    await addMember(koId, uid, p.name.split(" ")[0]);
    await importSubmission(koId, { contestant: { name: p.name, email: p.email, tiebreak: p.tiebreak }, picks: buildKnockoutPicks(mulberry32(p.seed * 53), p.chalk) });
  }

  // 6) MD3QA — Match Day 3 Pickem, ~14 entries. Seed with an early `now` so
  // every fixture is open and all predictions are written; then set 8 finals.
  const md3Id = await ensurePool({ joinCode: "MDPICK", name: "Match Day 3 Showdown", ownerId, format: "MATCH_DAY_3_PICKEM", tier: "FREE", ownerDisplay: "Dom" });
  const fixtures = md3Fixtures();
  const seedNow = new Date("2026-06-01T00:00:00Z"); // before any MD3 kickoff → all open
  const md3People = [owner, ...makePeople(13, 4000)];
  for (const p of md3People) {
    const uid = p.email === owner.email ? ownerId : await ensureUser(p);
    if (p.email !== owner.email) await addMember(md3Id, uid, p.name.split(" ")[0]);
    const rng = mulberry32(p.seed * 313);
    const scores: Md3Scores = {};
    for (const f of fixtures) scores[f.matchNo] = { home: Math.floor(rng() * 4), away: Math.floor(rng() * 4) };
    await upsertMd3Picks({ poolId: md3Id, userId: uid, label: p.name.split(" ")[0], scores }, seedNow);
  }
  // 8 finished MD3 matches.
  const md3Actuals: Array<[number, number]> = [[2, 1], [0, 0], [1, 2], [3, 1], [1, 1], [2, 0], [0, 2], [2, 2]];
  for (let i = 0; i < md3Actuals.length; i++) {
    const f = fixtures[i];
    const match = await prisma.match.findFirstOrThrow({ where: { tournamentId: tournament.id, matchNo: f.matchNo } });
    await prisma.result.upsert({
      where: { matchId: match.id },
      update: { homeTeamCode: f.homeCode, awayTeamCode: f.awayCode, homeScore: md3Actuals[i][0], awayScore: md3Actuals[i][1], status: "FINAL", source: "MANUAL" },
      create: { matchId: match.id, homeTeamCode: f.homeCode, awayTeamCode: f.awayCode, homeScore: md3Actuals[i][0], awayScore: md3Actuals[i][1], status: "FINAL", source: "MANUAL" },
    });
  }

  // 7) Chat + reactions in the HessFest pool.
  const chatMembers = await prisma.membership.findMany({ where: { poolId: hessId }, take: 8, select: { userId: true, displayName: true } });
  const existingMsgs = await prisma.chatMessage.count({ where: { poolId: hessId } });
  if (existingMsgs === 0 && chatMembers.length > 0) {
    const lines = [
      "Brackets are in! May the best chalk win 🍀",
      "I've got Brazil all the way 🇧🇷",
      "Bold. I'm fading the favorites this year.",
      "Group stage chaos incoming…",
      "Who picked the 0-0 draws? 😂",
      "Leaderboard looking spicy already.",
      "Anyone else regret their dark horse?",
      "GG everyone, good luck!",
    ];
    let firstId: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const m = chatMembers[i % chatMembers.length];
      const msg: { id: string } = await prisma.chatMessage.create({
        data: { poolId: hessId, userId: m.userId, kind: "USER", body: lines[i], replyToId: i === 3 ? firstId : null },
        select: { id: true },
      });
      if (i === 0) firstId = msg.id;
    }
    // A SYSTEM message + reactions on the opener.
    await prisma.chatMessage.create({ data: { poolId: hessId, kind: "SYSTEM", body: "Brazil 2–1 Serbia — FT", meta: { matchNo: 1, event: "FT" } } });
    if (firstId) {
      for (const m of chatMembers.slice(0, 4)) {
        await prisma.messageReaction.upsert({
          where: { messageId_userId_emoji: { messageId: firstId, userId: m.userId, emoji: "🔥" } },
          update: {},
          create: { messageId: firstId, userId: m.userId, emoji: "🔥" },
        });
      }
    }
  }

  // 9) Invites (pending, expired, email-addressed) + feedback.
  const invites = [
    { token: "qa-invite-pending", email: null as string | null, expiresAt: null as Date | null, acceptedAt: null as Date | null },
    { token: "qa-invite-expired", email: "lapsed@seed.test", expiresAt: new Date("2026-06-01T00:00:00Z"), acceptedAt: null },
    { token: "qa-invite-addressed", email: "newbie@seed.test", expiresAt: new Date("2026-12-31T00:00:00Z"), acceptedAt: null },
  ];
  for (const inv of invites) {
    await prisma.poolInvite.upsert({
      where: { token: inv.token },
      update: {},
      create: { poolId: hessId, token: inv.token, email: inv.email, role: "MEMBER", createdById: ownerId, expiresAt: inv.expiresAt, acceptedAt: inv.acceptedAt },
    });
  }
  const feedbackCount = await prisma.feedback.count();
  if (feedbackCount === 0) {
    await prisma.feedback.createMany({
      data: [
        { userId: ownerId, type: "BUG", title: "Leaderboard didn't refresh after a goal", description: "Had to reload to see the new score.", pageUrl: "/pool/HESSQA/leaderboard", userEmail: owner.email },
        { type: "IDEA", title: "Add a head-to-head compare view", description: "Would love to compare my bracket vs a friend.", pageUrl: "/pool/HESSQA" },
        { type: "OTHER", title: "Love the app!", description: "Great work 🎉" },
      ],
    });
  }

  // Recompute scoring pools.
  const hessBoard = await recomputePool(hessId);
  await recomputePool(capId);
  const koBoard = await recomputePool(koId);
  const md3Board = await recomputePool(md3Id);

  // Summary.
  const counts = {
    users: await prisma.user.count(),
    pools: await prisma.pool.count(),
    memberships: await prisma.membership.count(),
    entries: await prisma.entry.count(),
    picks: await prisma.pick.count(),
    chat: await prisma.chatMessage.count(),
    invites: await prisma.poolInvite.count(),
    feedback: await prisma.feedback.count(),
  };
  console.log("\n=== QA dataset ready ===");
  console.log(counts);
  console.log(`\nFREECAP cap probe (cap=${FREE_MEMBER_CAP}): joined=${joined}, then -> "${capProbe}"`);
  console.log(`\nHESSQA  /pool/HESSQA   (${hessBoard.length} brackets) top: ${hessBoard.slice(0, 3).map((r) => `${r.label} ${r.total}`).join(", ")}`);
  console.log(`KOQA    /pool/KNOCKO     (${koBoard.length} brackets) top: ${koBoard.slice(0, 3).map((r) => `${r.label} ${r.total}`).join(", ")}`);
  console.log(`MD3QA   /pool/MDPICK    (${md3Board.length} entries) top: ${md3Board.slice(0, 3).map((r) => `${r.label} ${r.total}`).join(", ")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
