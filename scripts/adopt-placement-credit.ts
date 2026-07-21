// Cutover + impact tool for adopting placement-agnostic knockout credit
// (Tournament.scoringConfig.knockoutPlacementAgnostic). READ-ONLY by default —
// it prints the before/after for every surface the tournament-wide flag would
// move (the HessFest pool, the other KNOCKOUT pools, and standalone KNOCKOUT
// brackets) and writes nothing. Pass --commit to actually flip the flag.
//
//   env $ENV npx tsx scripts/adopt-placement-credit.ts              # dry-run impact report
//   env $ENV npx tsx scripts/adopt-placement-credit.ts --write-json # write the audit record only (no flag flip)
//   env $ENV npx tsx scripts/adopt-placement-credit.ts --commit     # write audit record AND flip the flag
//
// --commit is idempotent and guarded: it aborts unless the final (match 104) is
// already recorded in the answer key, so "before" is a settled board under the
// OLD rule and the diff isolates the rule's effect. It writes
// data/placement-credit-cutover.json (the immutable audit record the statement
// page and leaderboard chips read) and recomputes every affected pool with
// snapshots suppressed, so the change never masquerades as a live "top mover".

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { bracketScoreEntries } from "@/lib/games/bracket-score";
import type { ScorableGameEntry, ScoringContext } from "@/lib/games/types";
import { asResults, asScoringConfig, recomputePool, recomputeStandalone } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { DEFAULT_SCORING, type ScoringConfig } from "@/lib/scoring/score";
import type { Results } from "@/lib/scoring/types";

const POOL_NAME = "HessFest 2026";
const FLAG = "knockoutPlacementAgnostic";
const OUT = join(process.cwd(), "data", "placement-credit-cutover.json");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bracket scoring never touches the DB
const NO_TX = {} as any;

interface Row {
  entryId: string;
  label: string;
  beforeTotal: number;
  afterTotal: number;
  beforeRank: number;
  afterRank: number;
  rankDelta: number; // beforeRank − afterRank (positive = climbed)
  pointsDelta: number;
}

// Competition ranking: an entry's rank is 1 + the number of entries with a
// strictly greater total (ties share a place) — same criterion as the live board.
function rankBy(totals: Map<string, number>): Map<string, number> {
  const values = [...totals.values()];
  const rank = new Map<string, number>();
  for (const [id, total] of totals) {
    rank.set(id, 1 + values.filter((v) => v > total).length);
  }
  return rank;
}

// Score one set of bracket entries twice (flag off vs on) via the SAME engine the
// orchestrator uses — bracketScoreEntries, so positional AdvanceMaps resolve
// identically — and return per-entry before/after rows.
async function diff(
  entries: ScorableGameEntry[],
  labels: Map<string, string>,
  answer: Results,
  baseCfg: ScoringConfig,
): Promise<Row[]> {
  const ctx = (cfg: ScoringConfig): ScoringContext => ({
    tournamentId: "x",
    answer,
    cfg,
    now: new Date(),
  });
  const before = await bracketScoreEntries(NO_TX, entries, ctx({ ...baseCfg, [FLAG]: 0 }));
  const after = await bracketScoreEntries(NO_TX, entries, ctx({ ...baseCfg, [FLAG]: 1 }));

  const beforeTotal = new Map(before.map((s) => [s.entryId, s.totalPoints]));
  const afterTotal = new Map(after.map((s) => [s.entryId, s.totalPoints]));
  const beforeRank = rankBy(beforeTotal);
  const afterRank = rankBy(afterTotal);

  return entries
    .map((e) => {
      const bt = beforeTotal.get(e.id) ?? 0;
      const at = afterTotal.get(e.id) ?? 0;
      const br = beforeRank.get(e.id) ?? 0;
      const ar = afterRank.get(e.id) ?? 0;
      return {
        entryId: e.id,
        label: labels.get(e.id) ?? e.id,
        beforeTotal: bt,
        afterTotal: at,
        beforeRank: br,
        afterRank: ar,
        rankDelta: br - ar,
        pointsDelta: at - bt,
      };
    })
    .sort((a, b) => a.afterRank - b.afterRank || a.label.localeCompare(b.label));
}

function printBoard(title: string, rows: Row[]): void {
  console.log(`\n=== ${title} (${rows.length}) ===`);
  if (!rows.length) return;
  console.log(`  ${"#".padStart(3)}  ${"contestant".padEnd(24)} ${"was".padStart(4)} ${"now".padStart(4)} ${"±".padStart(3)}  move`);
  for (const r of rows) {
    const move = r.rankDelta === 0 ? "—" : r.rankDelta > 0 ? `↑${r.beforeRank}→${r.afterRank}` : `↓${r.beforeRank}→${r.afterRank}`;
    const flag = r.pointsDelta > 0 ? " *" : "";
    console.log(
      `  ${String(r.afterRank).padStart(3)}  ${r.label.padEnd(24)} ${String(r.beforeTotal).padStart(4)} ${String(r.afterTotal).padStart(4)} ${String(r.pointsDelta).padStart(3)}  ${move}${flag}`,
    );
  }
  const moved = rows.filter((r) => r.beforeRank !== r.afterRank).length;
  const gained = rows.filter((r) => r.pointsDelta > 0).length;
  console.log(`  → ${gained} gain points, ${moved} change rank.`);
}

async function loadBracketEntries(where: object) {
  const entries = await prisma.entry.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } } },
  });
  const labels = new Map(entries.map((e) => [e.id, e.label]));
  const scorable = entries.map((e) => ({
    id: e.id,
    picks: e.picks,
    knockoutAdvance: e.knockoutAdvance,
  })) as ScorableGameEntry[];
  return { scorable, labels };
}

async function main() {
  const commit = process.argv.includes("--commit");
  const writeJson = commit || process.argv.includes("--write-json");

  const tournament = await prisma.tournament.findFirstOrThrow({
    where: { pools: { some: { name: POOL_NAME } } },
    select: { id: true, officialResults: true, scoringConfig: true },
  });
  const answer = asResults(tournament.officialResults);
  const baseCfg = asScoringConfig(tournament.scoringConfig);

  const finalWinner = answer.knockout?.[104];
  console.log(`Tournament ${tournament.id} — final (104): ${finalWinner ?? "NOT RECORDED"}`);
  console.log(`Current ${FLAG}: ${baseCfg[FLAG]}`);

  // HessFest pool.
  const hessPool = await prisma.pool.findFirstOrThrow({ where: { name: POOL_NAME }, select: { id: true } });
  const hess = await loadBracketEntries({ poolId: hessPool.id });
  const hessRows = await diff(hess.scorable, hess.labels, answer, baseCfg);
  printBoard("HessFest 2026", hessRows);

  // Other KNOCKOUT pools (each scored on its own board).
  const koPools = await prisma.pool.findMany({
    where: { tournamentId: tournament.id, format: "KNOCKOUT" },
    select: { id: true, name: true },
  });
  for (const p of koPools) {
    const { scorable, labels } = await loadBracketEntries({ poolId: p.id });
    if (!scorable.length) continue;
    printBoard(`KNOCKOUT pool — ${p.name}`, await diff(scorable, labels, answer, baseCfg));
  }

  // Standalone KNOCKOUT brackets (poolId null). MD3 standalone is a different
  // module and unaffected by the flag, so it's excluded.
  const solo = await loadBracketEntries({ tournamentId: tournament.id, poolId: null, format: "KNOCKOUT" });
  printBoard("Standalone KNOCKOUT brackets", await diff(solo.scorable, solo.labels, answer, baseCfg));

  if (!writeJson) {
    console.log("\nDry run — nothing written. Re-run with --write-json or --commit.");
    return;
  }

  // The audit record isolates the RULE's effect, so it requires the final to be
  // recorded (both before and after are computed against the settled answer key).
  if (!finalWinner) {
    throw new Error("Refusing to write the audit record: match 104 (the final) is not in the answer key. Record it first.");
  }

  // Immutable audit record for the statement page + leaderboard chips.
  const record = {
    generatedAt: new Date().toISOString(),
    tournamentId: tournament.id,
    poolId: hessPool.id,
    poolName: POOL_NAME,
    rule: FLAG,
    finalWinner,
    entries: hessRows,
  };
  writeFileSync(OUT, JSON.stringify(record, null, 2) + "\n");
  console.log(`\nWrote ${OUT} (${hessRows.length} entries).`);

  if (!commit) {
    console.log("Audit record written; flag NOT flipped. Re-run with --commit to go live.");
    return;
  }

  // ---- COMMIT ---------------------------------------------------------------
  if (baseCfg[FLAG] === 1) {
    console.log("\nFlag already on — recomputing to be safe.");
  }

  // Flip the flag on the tournament config.
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { scoringConfig: { ...baseCfg, [FLAG]: 1 } },
  });
  console.log(`Set ${FLAG} = 1 on tournament ${tournament.id}.`);

  // Recompute every affected pool with snapshots suppressed (this is a rule
  // change, not a result), then standalone brackets. Notify each pool's open
  // clients via SSE; no native push (a rule change isn't a match event).
  const pools = await prisma.pool.findMany({ where: { tournamentId: tournament.id }, select: { id: true } });
  for (const p of pools) {
    await recomputePool(p.id, { captureSnapshots: false });
    await notifyPool(p.id, "result");
  }
  await recomputeStandalone(tournament.id);
  console.log(`Recomputed ${pools.length} pool(s) + standalone brackets. Cutover complete.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
