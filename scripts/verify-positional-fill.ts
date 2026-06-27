// Smoke for the positional knockout fill pipeline (pure — no DB needed):
//   fill by position against a SPARSE seed → reload (JSON round-trip) →
//   resolve against the FINAL official seed → score. Mirrors what the builder,
//   submit-picks, and lib/pool/scoring do, end to end.
//
//   env $ENV npx tsx scripts/verify-positional-fill.ts   (env optional; no DB)

import { GROUPS, R32 } from "@/lib/scoring/data";
import type { ResolvedR32 } from "@/lib/scoring/resolve";
import { scorePicks } from "@/lib/scoring/score";
import { emptyPicks, type Results } from "@/lib/scoring/types";
import {
  resolveAdvance,
  validateAdvanceMap,
  asAdvanceMap,
  advanceProgress,
  type AdvanceMap,
} from "@/lib/pool/knockout-advance";
import { knockoutR32Seed } from "@/lib/pool/knockout";
import { scoredKnockoutNumbers } from "@/lib/pool/pick-form";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

// A complete answer key → the FINAL official seed (all 16 R32 matches seated).
const answer: Results = { ...emptyPicks(), finalGoals: null };
for (const g of Object.keys(GROUPS)) {
  answer.groupFirst[g] = GROUPS[g][0];
  answer.groupSecond[g] = GROUPS[g][1];
}
answer.thirdAdvance = Object.keys(GROUPS).slice(0, 8).map((g) => GROUPS[g][2]);
const finalSeed = knockoutR32Seed(answer);

// A SPARSE early seed: only the first 3 R32 matches have any team (the rest TBD),
// as if barely any group data has landed yet.
const sparseSeed: ResolvedR32 = {};
for (const m of R32) sparseSeed[m.id] = { a: null, b: null };
for (const id of [73, 74, 75]) sparseSeed[id] = finalSeed[id];

console.log("1. Fill the WHOLE bracket by position against the sparse seed:");
const advance: AdvanceMap = Object.fromEntries(
  scoredKnockoutNumbers().map((n) => [n, "a"]),
) as AdvanceMap;
assert(validateAdvanceMap(advance), "the filled AdvanceMap is structurally valid");
assert(advanceProgress(advance).done === 31, "progress reads 31/31 with no team data");
const earlyDisplay = resolveAdvance(advance, sparseSeed);
assert(
  Object.keys(earlyDisplay).length > 0 && Object.keys(earlyDisplay).length < 31,
  "display materializes only the few seated slots early (rest still TBD)",
);

console.log("2. Reload (JSON round-trip through the DB column):");
const reloaded = asAdvanceMap(JSON.parse(JSON.stringify(advance)));
assert(JSON.stringify(reloaded) === JSON.stringify(advance), "the AdvanceMap survives a reload");

console.log("3. Field finalizes → resolve against the official seed → score:");
const finalKnockout = resolveAdvance(reloaded, finalSeed);
assert(Object.keys(finalKnockout).length === 31, "all 31 winners materialize once the field is set");
const results: Results = { ...answer, knockout: { ...finalKnockout } };
const scored = scorePicks({ ...emptyPicks(), knockout: finalKnockout }, results);
const ko = scored.breakdown;
assert(ko.r32 + ko.r16 + ko.qf + ko.sf + ko.final > 0, "the position-only bracket scores points");

console.log("\nPASS — positional fill survives a reload and scores against the final field.");
