// Read-only "what-if" analysis: would giving credit for knockout picks that were
// stranded by a wrong group-stage PLACEMENT change the HessFest leaderboard?
//
// Background: scorePicks credits a knockout pick only when your picked winner
// matches the ACTUAL winner of the SAME match-id, and each match-id is a fixed
// bracket slot (1A, 2C, ...). So if you seed a team in the wrong group position,
// that team enters a different R32 slot than reality and every round of its real
// run is stranded (except the unique Final slot 104). This script recomputes each
// bracket under a placement-agnostic rule -- a knockout round awards its points for
// every team you picked to win a match in that round that ACTUALLY won a match in
// that round, regardless of slot -- and diffs the leaderboard. It writes nothing.
//
// Run with: <ENV pointing at the data DB> npx tsx scripts/knockout-placement-credit.ts [ESP,ARG,...]
//   The optional CSV arg limits the "who placed these teams wrong" diagnostic to
//   those team codes (default ESP,ARG -- the 2026 finalists).

import { prisma } from "@/lib/db";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { asResults, asScoringConfig } from "@/lib/pool/scoring";
import { scorePicks, roundPointsFor, type ScoringConfig } from "@/lib/scoring/score";
import { GROUPS, TEAMS } from "@/lib/scoring/data";
import type { Picks, Results } from "@/lib/scoring/types";

const POOL_NAME = "HessFest 2026";

// Knockout rounds by match-id range (mirrors roundPointsFor in score.ts). Bronze
// (103) is intentionally excluded -- it is not scored.
const ROUNDS: Array<{ name: string; ids: number[] }> = [
  { name: "R32", ids: range(73, 88) },
  { name: "R16", ids: range(89, 96) },
  { name: "QF", ids: range(97, 100) },
  { name: "SF", ids: [101, 102] },
  { name: "Final", ids: [104] },
];

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const teamName = (code: string) => TEAMS[code] ?? code;

function groupOf(code: string): string | null {
  for (const [g, teams] of Object.entries(GROUPS)) if (teams.includes(code)) return g;
  return null;
}

// The set of teams a picks/results object has WIN at least one match in a round,
// and the placement-agnostic knockout credit that follows from it.
function winnersInRound(kn: Record<number, string>, ids: number[]): Set<string> {
  const s = new Set<string>();
  for (const id of ids) {
    const w = kn?.[id];
    if (w) s.add(w);
  }
  return s;
}

interface PlacementCredit {
  knockoutPts: number; // placement-agnostic knockout total
  gained: number; // points gained vs slot-based scoring
  // Per round: teams newly credited because reality advanced them from a slot the
  // bracket never predicted (the "stranded" picks this rule rescues).
  rescued: Array<{ round: string; team: string; pts: number }>;
}

// Placement-agnostic knockout credit + which teams it rescues relative to the
// slot-based scoring that scorePicks does today.
function placementCredit(picks: Picks, results: Results, cfg: ScoringConfig): PlacementCredit {
  let knockoutPts = 0;
  let slotPts = 0;
  const rescued: PlacementCredit["rescued"] = [];

  for (const { name, ids } of ROUNDS) {
    const pts = roundPointsFor(ids[0], cfg);
    const picked = winnersInRound(picks.knockout || {}, ids);
    const actual = winnersInRound(results.knockout || {}, ids);

    // Slot-based credit today: same team wins the SAME match-id.
    const slotTeams = new Set<string>();
    for (const id of ids) {
      const a = results.knockout?.[id];
      if (a && picks.knockout?.[id] === a) slotTeams.add(a);
    }
    slotPts += slotTeams.size * pts;

    // Placement-agnostic: team you picked to win in this round actually won in it.
    for (const t of picked) {
      if (!actual.has(t)) continue;
      knockoutPts += pts;
      if (!slotTeams.has(t)) rescued.push({ round: name, team: t, pts });
    }
  }
  return { knockoutPts, gained: knockoutPts - slotPts, rescued };
}

async function main() {
  const targets = (process.argv[2] ?? "ESP,ARG")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const pool = await prisma.pool.findFirstOrThrow({
    where: { name: POOL_NAME },
    include: {
      tournament: { select: { officialResults: true, scoringConfig: true } },
      entries: {
        orderBy: { createdAt: "asc" },
        select: {
          label: true,
          claimEmail: true,
          picks: { select: { section: true, category: true, key: true, code: true, teamOrValue: true } },
        },
      },
    },
  });

  const results = asResults(pool.tournament.officialResults);
  const cfg = asScoringConfig(pool.tournament.scoringConfig);

  // ---- Reality snapshot for the target teams -----------------------------------
  console.log(`\n=== Reality (answer key) for target teams ===`);
  for (const code of targets) {
    const g = groupOf(code);
    const real1 = g ? results.groupFirst?.[g] : undefined;
    const real2 = g ? results.groupSecond?.[g] : undefined;
    const finished =
      real1 === code ? "1st" : real2 === code ? "2nd" : g ? "did not finish top-2" : "unknown group";
    const runs = ROUNDS.filter((r) => winnersInRound(results.knockout || {}, r.ids).has(code)).map(
      (r) => r.name,
    );
    console.log(
      `  ${teamName(code)} (${code}) — Group ${g ?? "?"}: finished ${finished}; won matches in: ${
        runs.join(", ") || "none"
      }`,
    );
  }

  // ---- Q1: who placed a target team in the WRONG group position ----------------
  console.log(`\n=== Contestants who placed a finalist in a group position != reality ===`);
  let misplacers = 0;
  for (const e of pool.entries) {
    const sub = pickRowsToSubmission(e.picks, { name: e.label, email: e.claimEmail ?? "", tiebreak: "" });
    const notes: string[] = [];
    for (const code of targets) {
      const g = groupOf(code);
      if (!g) continue;
      const pick1 = sub.picks.groupFirst?.[g];
      const pick2 = sub.picks.groupSecond?.[g];
      const realPos = results.groupFirst?.[g] === code ? 1 : results.groupSecond?.[g] === code ? 2 : 0;
      const pickPos = pick1 === code ? 1 : pick2 === code ? 2 : 0;
      if (pickPos && realPos && pickPos !== realPos) {
        notes.push(`${code} picked ${pickPos === 2 ? "2nd" : "1st"} but finished ${realPos === 1 ? "1st" : "2nd"}`);
      } else if (pickPos === 0) {
        notes.push(`${code} not in their top-2`);
      }
    }
    if (notes.length) {
      misplacers++;
      console.log(`  ${e.label}: ${notes.join("; ")}`);
    }
  }
  if (!misplacers) console.log("  (none — everyone seeded the finalists in the real position)");

  // ---- Q2: leaderboard impact --------------------------------------------------
  const rows = pool.entries.map((e) => {
    const sub = pickRowsToSubmission(e.picks, { name: e.label, email: e.claimEmail ?? "", tiebreak: "" });
    const current = scorePicks(sub.picks, results, cfg);
    const knockoutNow =
      current.breakdown.r32 + current.breakdown.r16 + current.breakdown.qf + current.breakdown.sf + current.breakdown.final;
    const nonKnockout = current.total - knockoutNow;
    const pc = placementCredit(sub.picks, results, cfg);
    return {
      label: e.label,
      current: current.total,
      proposed: nonKnockout + pc.knockoutPts,
      gained: pc.gained,
      rescued: pc.rescued,
    };
  });

  const byCurrent = [...rows].sort((a, b) => b.current - a.current || a.label.localeCompare(b.label));
  const rankNow = new Map(byCurrent.map((r, i) => [r.label, i + 1]));
  const byProposed = [...rows].sort((a, b) => b.proposed - a.proposed || a.label.localeCompare(b.label));

  console.log(`\n=== Leaderboard: current vs placement-credit ===`);
  console.log(`  ${"#".padStart(3)}  ${"contestant".padEnd(24)} ${"now".padStart(4)} ${"new".padStart(4)} ${"+".padStart(3)}  rank move`);
  byProposed.forEach((r, i) => {
    const newRank = i + 1;
    const oldRank = rankNow.get(r.label)!;
    const move = oldRank === newRank ? "—" : oldRank > newRank ? `↑${oldRank}→${newRank}` : `↓${oldRank}→${newRank}`;
    const flag = r.gained > 0 ? " *" : "";
    console.log(
      `  ${String(newRank).padStart(3)}  ${r.label.padEnd(24)} ${String(r.current).padStart(4)} ${String(r.proposed).padStart(4)} ${String(r.gained).padStart(3)}  ${move}${flag}`,
    );
  });

  console.log(`\n=== Who gained, and from which stranded picks ===`);
  const gainers = rows.filter((r) => r.gained > 0).sort((a, b) => b.gained - a.gained);
  if (!gainers.length) console.log("  (nobody — no knockout pick was stranded by a placement miss)");
  for (const r of gainers) {
    const detail = r.rescued.map((x) => `${x.round}:${teamName(x.team)}(+${x.pts})`).join(", ");
    console.log(`  ${r.label.padEnd(24)} +${r.gained}  [${detail}]`);
  }

  const changed = byProposed.filter((r, i) => rankNow.get(r.label) !== i + 1).length;
  console.log(
    `\nSummary: ${gainers.length}/${rows.length} brackets gain points; ${changed} change rank. Leader now: ${
      byCurrent[0]?.label
    } (${byCurrent[0]?.current}) -> under placement credit: ${byProposed[0]?.label} (${byProposed[0]?.proposed}).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
