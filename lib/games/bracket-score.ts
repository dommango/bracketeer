// Shared bracket scoring for the FULL_BRACKET and KNOCKOUT modules. This is a
// VERBATIM lift of the former scoreEntryBreakdowns loop (lib/pool/scoring.ts),
// minus the ScoreBreakdown upsert: the same
//   pickRowsToSubmission → (positional) resolveAdvance → scorePicks
// order, so scorePicks receives byte-identical args and parity with the oracle is
// untouched. Returns rows for the orchestrator to upsert. Bracket scoring never
// touches the DB, so `tx` is unused (kept for a uniform GameModule signature).

import type { Prisma } from "@/generated/prisma/client";
import { scorePicks } from "@/lib/scoring/score";
import { pickRowsToSubmission } from "@/lib/pool/picks";
import { knockoutR32Seed } from "@/lib/pool/knockout";
import { resolveAdvance, validateAdvanceMap } from "@/lib/pool/knockout-advance";
import type { ScorableGameEntry, ScoringContext, ScoredEntry } from "./types";

type Db = Prisma.TransactionClient;

export async function bracketScoreEntries(
  _tx: Db,
  entries: ScorableGameEntry[],
  ctx: ScoringContext,
): Promise<ScoredEntry[]> {
  const out: ScoredEntry[] = [];
  for (const entry of entries) {
    const sub = pickRowsToSubmission(entry.picks);
    // A positional bracket's winners come from its AdvanceMap, resolved against the
    // OFFICIAL seed — so an early pick scores correctly however stale its Pick rows
    // are. scorePicks still only ever sees team codes, so parity is untouched.
    if (entry.knockoutAdvance != null && validateAdvanceMap(entry.knockoutAdvance)) {
      sub.picks.knockout = resolveAdvance(entry.knockoutAdvance, knockoutR32Seed(ctx.answer));
    }
    const { total, breakdown } = scorePicks(sub.picks, ctx.answer, ctx.cfg);
    out.push({ entryId: entry.id, totalPoints: total, byCategory: breakdown });
  }
  return out;
}
