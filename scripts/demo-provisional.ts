// Demo: live provisional group standings.
//
// Injects a realistic "matchday in progress" state into the WC2026 group stage
// (each team has played 2 of 3; the third-round match is shown LIVE), recomputes
// the HessFest pool, then prints exactly what the bracket page and leaderboard
// render: per-group live tables, the provisional 1st/2nd/3rd the engine derives,
// the best-8 third-place advancers, and each entry's ▲ live points delta.
//
// The tournament answer key (officialResults) is NOT touched — provisional fills
// every group precisely because no official standings have been entered. Re-run
// safe (upserts the same Result rows). To clear the demo afterwards see the note
// printed at the end.
//
//   env $ENV npx tsx scripts/demo-provisional.ts

import { prisma } from "@/lib/db";
import { GROUPS, TEAMS, buildGroupPairMatchNos } from "@/lib/scoring/data";
import { upsertGroupMatchResultFromApi, recomputeTournamentPools } from "@/lib/pool/results";
import { getPoolView, getPoolBracket } from "@/lib/pool/queries";
import { provisionalStandings, type GroupTableRow } from "@/lib/pool/group-table";
import type { GroupLetter } from "@/lib/scoring/types";

const JOIN_CODE = "HESS26";

// Pairings played so far, as indices into GROUPS[letter] (seeded strong→weak).
// This set gives every team exactly two games; the remaining (0,3) and (1,2) are
// left untouched (still SCHEDULED), so each group is mid-stage.
const PLAYED: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
];

// The third-round match (2,3) is shown as in-progress (LIVE); the rest are FINAL.
const isLive = (i: number, j: number) => i === 2 && j === 3;

// Deterministic scorelines. Home (index i) is the stronger seed, so it generally
// wins — yielding a clear 1st/2nd/3rd in every group EXCEPT Group A, where the
// top-two clash is drawn to leave 1st/2nd genuinely tied (shows the "=" marker
// and an empty provisional slot). The 3rd-place team's goals vary by group so the
// twelve thirds sort cleanly into a best-8 cut.
function scoreline(g: number, i: number, j: number): readonly [number, number] {
  if (i === 0 && j === 1) return g === 0 ? [1, 1] : [2, 1];
  if (i === 0 && j === 2) return [2, 0];
  if (i === 1 && j === 3) return [2, 0];
  if (i === 2 && j === 3) return [1 + (g % 3), 0];
  return [0, 0];
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
function lpad(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}
function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
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

  // --- Inject the live group-stage state ---
  let applied = 0;
  for (let g = 0; g < letters.length; g++) {
    const letter = letters[g];
    const teams = GROUPS[letter];
    for (const [i, j] of PLAYED) {
      const homeCode = teams[i];
      const awayCode = teams[j];
      const matchNo = pairNo.get([homeCode, awayCode].slice().sort().join("_"));
      if (!matchNo) throw new Error(`No matchNo for ${homeCode} v ${awayCode}`);
      const [homeScore, awayScore] = scoreline(g, i, j);
      const live = isLive(i, j);
      const { applied: didApply } = await upsertGroupMatchResultFromApi(tournament.id, matchNo, {
        homeCode,
        awayCode,
        homeScore,
        awayScore,
        live,
        finished: !live,
        elapsed: live ? 63 : null,
      });
      if (didApply) applied += 1;
    }
  }
  await recomputeTournamentPools(tournament.id);
  console.log(`Injected ${applied} group results (3 FINAL + 1 LIVE per group), pool recomputed.\n`);

  // --- Print the group tables exactly as the bracket page renders them ---
  const bracket = await getPoolBracket(pool.id);
  if (!bracket) throw new Error("getPoolBracket returned null");

  console.log("LIVE GROUP TABLES  (P=played, GD=goal diff, Pts=points; * = advancing, = tied)");
  console.log("─".repeat(78));
  for (const grp of bracket.groups) {
    const live = grp.provisional ? "  ● LIVE / provisional" : "  (official)";
    const head =
      `Group ${grp.group}${live}` +
      `   1st: ${grp.first ?? "—(tied)"}   2nd: ${grp.second ?? "—(tied)"}`;
    console.log(head);
    console.log("   " + pad("#", 3) + pad("Team", 6) + lpad("P", 3) + lpad("GD", 5) + lpad("Pts", 5) + "  ");
    for (const r of grp.table) {
      const mark = r.rank <= 2 ? "*" : r.tied ? "=" : " ";
      console.log(
        "   " +
          pad(`${r.rank}${mark}`, 3) +
          pad(r.code, 6) +
          lpad(`${r.played}`, 3) +
          lpad(signed(r.gd), 5) +
          lpad(`${r.pts}`, 5) +
          (r.tied ? "  = tied" : ""),
      );
    }
    console.log("");
  }

  // --- Provisional third-place advancers (best 8 of 12) ---
  // BracketView.thirds exposes only the OFFICIAL thirds (empty until an admin
  // finalizes), so derive the provisional ones from the same live tables the
  // bracket already returned — this is what feeds each entry's ▲ thirds points.
  const tables = Object.fromEntries(
    bracket.groups.map((grp) => [grp.group, grp.table]),
  ) as Record<GroupLetter, GroupTableRow[]>;
  const provThirds = provisionalStandings(tables).thirdAdvance;
  console.log("PROVISIONAL THIRD-PLACE ADVANCERS (best 8 of 12)");
  console.log("─".repeat(78));
  console.log(
    "   " +
      (provThirds.length
        ? provThirds.map((c) => `${c} (${TEAMS[c] ?? c})`).join(", ")
        : "none yet"),
  );
  console.log(`   ${provThirds.length}/8 slots filled (groups with a tied 3rd contribute none)\n`);

  // --- Leaderboard with the ▲ live delta, exactly as the standings page shows ---
  const view = await getPoolView(JOIN_CODE);
  if (!view) throw new Error("getPoolView returned null");

  const withLive = view.leaderboard.filter((r) => r.projected && r.projected > 0).length;
  console.log(`LEADERBOARD — ${view.name}  (${view.leaderboard.length} entries, ${withLive} gaining live points)`);
  console.log("   order is by official total, with the additive ▲ live badge — matches the UI");
  console.log("─".repeat(78));
  console.log("   " + pad("#", 4) + pad("Entry", 26) + lpad("Total", 6) + "   ▲ live");
  for (const r of view.leaderboard.slice(0, 15)) {
    const live = r.projected ? `▲ ${r.projected}` : "";
    console.log(
      "   " + pad(`${r.rank}`, 4) + pad(r.label.slice(0, 25), 26) + lpad(`${r.total}`, 6) + "   " + live,
    );
  }
  if (view.leaderboard.length > 15) console.log(`   … and ${view.leaderboard.length - 15} more`);

  // Re-ranked by official total + ▲ live. The app does NOT currently sort this
  // way (the badge is additive-display-only), so during the group stage — before
  // any official result is entered — the real standing is only visible here.
  console.log("\nPROVISIONAL LEADERBOARD — re-ranked by total + ▲ live (not how the UI sorts yet)");
  console.log("─".repeat(78));
  const provRanked = [...view.leaderboard]
    .map((r) => ({ ...r, live: r.total + (r.projected ?? 0) }))
    .sort((a, b) => b.live - a.live || a.label.localeCompare(b.label));
  console.log("   " + pad("#", 4) + pad("Entry", 26) + lpad("Provisional", 12));
  provRanked.slice(0, 10).forEach((r, idx) => {
    const place = idx > 0 && provRanked[idx - 1].live === r.live ? "" : `${idx + 1}`;
    console.log("   " + pad(place, 4) + pad(r.label.slice(0, 25), 26) + lpad(`${r.live}`, 12));
  });

  console.log("\nView it live:  npm run dev  →  http://localhost:3000/pool/HESS26/bracket");
  console.log("                                http://localhost:3000/pool/HESS26/leaderboard");
  console.log("Clear the demo: re-run with the answer key untouched, or DELETE the LIVE/FINAL");
  console.log("group Result rows (matchNo ≤ 72) and recompute.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
