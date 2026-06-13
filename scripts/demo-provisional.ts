// Demo: live provisional group standings + auto-promotion on completion.
//
// Injects a mixed group-stage state and shows the three lifecycle states:
//   • Groups A–C are COMPLETE (all six matches FINAL). B and C have a clear
//     1st/2nd, so they auto-promote into the official answer key — the "Live"
//     badge drops, their points move into the base total, and the knockout
//     bracket (which reads official) fills in. A finished level at the top, so it
//     stays unpromoted, awaiting an admin tiebreak.
//   • Groups D–L are IN PROGRESS (each team has played 2 of 3, one match LIVE) —
//     provisional/live, contributing the additive ▲ delta.
// Then it prints the group tables, the resolved R32 matchups, and the leaderboard
// RE-RANKED by live total (official + provisional).
//
// Re-run safe. To reset the answer key between runs, clear Tournament.official
// group standings (or just re-run — promotion only fills empty official slots).
//
//   env $ENV npx tsx scripts/demo-provisional.ts

import { prisma } from "@/lib/db";
import { GROUPS, buildGroupPairMatchNos } from "@/lib/scoring/data";
import {
  upsertGroupMatchResultFromApi,
  promoteCompletedGroupsToOfficial,
  recomputeTournamentPools,
} from "@/lib/pool/results";
import { getPoolView, getPoolBracket } from "@/lib/pool/queries";
import type { GroupLetter } from "@/lib/scoring/types";

const JOIN_CODE = "HESS26";
const COMPLETE_DETERMINATE = new Set(["B", "C"]); // finish with a clear 1st/2nd
const COMPLETE_TIED = "A"; // finishes level at the top → awaiting admin tiebreak

interface Inj {
  i: number;
  j: number;
  hs: number;
  as: number;
  live: boolean;
}

// All six pairings of a 4-team group, indices into GROUPS[letter] (strong→weak).
const ALL_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

function injectionsFor(letter: string, g: number): Inj[] {
  if (letter === COMPLETE_TIED) {
    // Seeds 0 and 1 draw and both sweep the rest → tied for 1st on every metric.
    return [
      { i: 0, j: 1, hs: 1, as: 1, live: false },
      { i: 0, j: 2, hs: 2, as: 0, live: false },
      { i: 0, j: 3, hs: 2, as: 0, live: false },
      { i: 1, j: 2, hs: 2, as: 0, live: false },
      { i: 1, j: 3, hs: 2, as: 0, live: false },
      { i: 2, j: 3, hs: 1, as: 0, live: false },
    ];
  }
  if (COMPLETE_DETERMINATE.has(letter)) {
    // Stronger seed wins every game → finishing order is exactly the seed order.
    return ALL_PAIRS.map(([i, j]) => ({ i, j, hs: 2, as: i === 1 && j === 2 ? 1 : 0, live: false }));
  }
  // In progress: each team has played 2 of 3; the third-round (2,3) is LIVE.
  return [
    { i: 0, j: 1, hs: 2, as: 1, live: false },
    { i: 0, j: 2, hs: 2, as: 0, live: false },
    { i: 1, j: 3, hs: 2, as: 0, live: false },
    { i: 2, j: 3, hs: 1 + (g % 3), as: 0, live: true },
  ];
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
function lpad(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

async function main() {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  const pool = await prisma.pool.findUniqueOrThrow({
    where: { joinCode: JOIN_CODE },
    select: { id: true, name: true },
  });

  const pairNo = buildGroupPairMatchNos();
  const letters = Object.keys(GROUPS) as GroupLetter[];

  // --- Inject the group-stage state ---
  let applied = 0;
  for (let g = 0; g < letters.length; g++) {
    const letter = letters[g];
    const teams = GROUPS[letter];
    for (const inj of injectionsFor(letter, g)) {
      const homeCode = teams[inj.i];
      const awayCode = teams[inj.j];
      const matchNo = pairNo.get([homeCode, awayCode].slice().sort().join("_"));
      if (!matchNo) throw new Error(`No matchNo for ${homeCode} v ${awayCode}`);
      const { applied: didApply } = await upsertGroupMatchResultFromApi(tournament.id, matchNo, {
        homeCode,
        awayCode,
        homeScore: inj.hs,
        awayScore: inj.as,
        live: inj.live,
        finished: !inj.live,
        elapsed: inj.live ? 63 : null,
      });
      if (didApply) applied += 1;
    }
  }

  // Promote any group whose six matches are all FINAL into the official key, then
  // recompute pools against it (exactly what the cron poller does).
  const promoted = await promoteCompletedGroupsToOfficial(tournament.id);
  await recomputeTournamentPools(tournament.id);
  console.log(`Injected ${applied} group results.`);
  console.log(`Auto-promoted to official: ${promoted.length ? promoted.join(", ") : "none"}\n`);

  // --- Group tables, with each group's lifecycle state ---
  const bracket = await getPoolBracket(pool.id);
  if (!bracket) throw new Error("getPoolBracket returned null");

  console.log("GROUP TABLES  (P=played, GD, Pts; * advancing, = tied)");
  console.log("─".repeat(78));
  for (const grp of bracket.groups) {
    const complete = grp.table.length === 4 && grp.table.every((r) => r.played === 3);
    const state = grp.provisional
      ? "● LIVE / provisional"
      : complete && grp.first
        ? "✓ FINAL → promoted to official"
        : complete
          ? "✓ FINAL (tied — awaiting admin tiebreak)"
          : "—";
    console.log(
      `Group ${grp.group}  ${state}` +
        `   1st: ${grp.first ?? "—"}   2nd: ${grp.second ?? "—"}`,
    );
    for (const r of grp.table) {
      const mark = r.rank <= 2 ? "*" : " ";
      console.log(
        "   " +
          pad(`${r.rank}${mark}`, 3) +
          pad(r.code, 6) +
          lpad(`${r.played}`, 2) +
          lpad(signed(r.gd), 5) +
          lpad(`${r.pts}`, 4) +
          (r.tied ? "  = tied" : ""),
      );
    }
    console.log("");
  }

  // --- R32 matchups now resolvable from the promoted groups ---
  console.log("R32 BRACKET — slots filled by promoted groups (TBD until both feeders settle)");
  console.log("─".repeat(78));
  const r32 = bracket.rounds[0].matches.filter((m) => m.home !== "TBD" || m.away !== "TBD");
  if (r32.length === 0) console.log("   (no R32 slots resolved yet)");
  for (const m of r32) {
    console.log(`   M${m.matchNo}:  ${pad(m.home, 22)} v  ${m.away}`);
  }
  console.log("");

  // --- Leaderboard, RE-RANKED by live total; ▲ shows the still-provisional part ---
  const view = await getPoolView(JOIN_CODE);
  if (!view) throw new Error("getPoolView returned null");
  console.log(`LEADERBOARD — ${view.name}  (re-ranked by live total; ▲ = still provisional)`);
  console.log("─".repeat(78));
  console.log("   " + pad("#", 4) + pad("Entry", 26) + lpad("Total", 6) + "   ▲ live");
  for (const r of view.leaderboard.slice(0, 12)) {
    const live = r.projected ? `▲ ${r.projected}` : "";
    console.log(
      "   " + pad(`${r.rank}`, 4) + pad(r.label.slice(0, 25), 26) + lpad(`${r.total}`, 6) + "   " + live,
    );
  }
  if (view.leaderboard.length > 12) console.log(`   … and ${view.leaderboard.length - 12} more`);

  console.log("\nView it live:  npm run dev  →  http://localhost:3000/pool/HESS26/bracket");
  console.log("                                http://localhost:3000/pool/HESS26/leaderboard");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
