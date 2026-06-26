// One-off backfill: recompute MatchOdds home/draw/away probabilities from each
// row's stored `raw` payload, applying the current orientToHome reorientation.
//
// Why: orientToHome (lib/odds/map.ts) was added in PR #51 (2026-06-17) to fix the
// odds bar rendering the away team's probability under the home team at neutral
// venues. Rows ingested before that fix stored the provider's home/away verbatim,
// so they're transposed. The raw provider event (homeName/awayName + decimals) is
// kept on every row, so we can re-derive the correct, reoriented probabilities
// WITHOUT spending an Odds API credit. The live poller already does this for any
// future refresh; this just heals the stale rows.
//
// Usage (dry-run prints the diff, writes nothing):
//   env $ENV npx tsx scripts/backfill-odds-orientation.ts
// Apply the changes:
//   env $ENV npx tsx scripts/backfill-odds-orientation.ts --apply

import { prisma } from "@/lib/db";
import { loadCodedMatches } from "@/lib/odds/coded";
import { normalizeTeam, orientToHome, toImpliedProbs } from "@/lib/odds/map";
import type { OddsEvent } from "@/lib/odds/parse";

const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

async function main() {
  const apply = process.argv.includes("--apply");

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true, officialResults: true },
  });
  if (!tournament) throw new Error("wc2026 tournament not found");

  // Same coded-match home/away the poller orients to (result row else draw slot),
  // so backfilled rows match what toMatchInput renders at display time.
  const coded = await loadCodedMatches(tournament.id, tournament.officialResults);
  const homeCodeByMatchNo = new Map(coded.map((m) => [m.matchNo, m.homeCode]));

  const rows = await prisma.matchOdds.findMany({
    select: { id: true, homeWinProb: true, drawProb: true, awayWinProb: true, raw: true, match: { select: { matchNo: true } } },
  });

  let changed = 0;
  let skipped = 0;
  const updates: { id: string; homeWinProb: number; drawProb: number; awayWinProb: number }[] = [];

  for (const row of rows) {
    const ev = row.raw as unknown as OddsEvent | null;
    if (!ev || ev.decimalHome == null || ev.decimalDraw == null || ev.decimalAway == null) {
      console.log(`match ${row.match.matchNo}: SKIP (raw missing decimals)`);
      skipped++;
      continue;
    }
    const apiHomeCode = normalizeTeam(ev.homeName);
    if (!apiHomeCode) {
      console.log(`match ${row.match.matchNo}: SKIP (raw homeName "${ev.homeName}" unmapped)`);
      skipped++;
      continue;
    }
    const targetHomeCode = homeCodeByMatchNo.get(row.match.matchNo) ?? null;
    const probs = orientToHome(
      toImpliedProbs(ev.decimalHome, ev.decimalDraw, ev.decimalAway),
      apiHomeCode,
      targetHomeCode,
    );

    const same =
      near(probs.homeWinProb, row.homeWinProb) &&
      near(probs.drawProb, row.drawProb) &&
      near(probs.awayWinProb, row.awayWinProb);
    if (same) continue;

    console.log(
      `match ${row.match.matchNo}: ${pct(row.homeWinProb)}/${pct(row.drawProb)}/${pct(row.awayWinProb)}` +
        ` -> ${pct(probs.homeWinProb)}/${pct(probs.drawProb)}/${pct(probs.awayWinProb)}` +
        ` (api home ${apiHomeCode}, our home ${targetHomeCode ?? "?"})`,
    );
    changed++;
    updates.push({ id: row.id, ...probs });
  }

  console.log(`\n${rows.length} rows, ${changed} need reorientation, ${skipped} skipped.`);

  if (!apply) {
    console.log("Dry run — pass --apply to write these changes.");
    return;
  }
  for (const u of updates) {
    await prisma.matchOdds.update({
      where: { id: u.id },
      data: { homeWinProb: u.homeWinProb, drawProb: u.drawProb, awayWinProb: u.awayWinProb },
    });
  }
  console.log(`Applied ${updates.length} updates.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
