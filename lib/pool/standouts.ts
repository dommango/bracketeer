// Pure pool-level "standouts": three lenses on the field of brackets that extend
// the pick-analytics card —
//   • upside     — entries with the most expected points still to come (EV).
//   • contrarian — entries whose signature picks (champion, finalists, group
//                  winners) the rest of the pool least shares.
//   • diversity  — how spread the pool's title picks are (a Gini–Simpson index).
// Env-free + unit-tested; the EV figures come from lib/pool/expected-points.ts via
// the query layer, so this degrades gracefully (empty `upside`) when no odds exist.

import { GROUPS } from "@/lib/scoring/data";
import type { GroupLetter, Picks } from "@/lib/scoring/types";

export interface StandoutInput {
  entryId: string;
  label: string;
  picks: Picks;
  // Expected remaining knockout points, or null when the win model has no data.
  expectedRemaining: number | null;
}

export interface StandoutRow {
  entryId: string;
  label: string;
  value: number; // EV points (upside) or a 0–100 contrarian score
}

export interface PoolDiversity {
  distinctChampions: number;
  index: number; // 0 (everyone picked one champion) … →1 (maximally spread), whole-ish
}

export interface PoolStandouts {
  totalEntries: number;
  upside: StandoutRow[]; // most expected remaining points first
  contrarian: StandoutRow[]; // most against-the-grain first
  diversity: PoolDiversity;
}

const GROUP_LETTERS = Object.keys(GROUPS) as GroupLetter[];

// Count occurrences of a code across entries for a single-slot pick.
function countBy(entries: StandoutInput[], pick: (p: Picks) => string | null | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const code = pick(e.picks);
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

// Membership counts for the two (unordered) finalist slots: an entry contributes
// once per distinct team it placed in the final.
function finalistCounts(entries: StandoutInput[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const codes = new Set([e.picks.knockout?.[101], e.picks.knockout?.[102]].filter(Boolean) as string[]);
    for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

export function buildPoolStandouts(entries: StandoutInput[], limit = 5): PoolStandouts {
  const total = entries.length;
  if (total === 0) {
    return { totalEntries: 0, upside: [], contrarian: [], diversity: { distinctChampions: 0, index: 0 } };
  }

  // Per-slot popularity, so a pick's "share" is measured against the same slot.
  const championCounts = countBy(entries, (p) => p.knockout?.[104]);
  const finalists = finalistCounts(entries);
  const groupCounts: Record<string, Map<string, number>> = {};
  for (const g of GROUP_LETTERS) groupCounts[g] = countBy(entries, (p) => p.groupFirst?.[g]);

  const share = (counts: Map<string, number>, code: string): number => (counts.get(code) ?? 0) / total;

  // Contrarian score: mean rarity (1 − pool share) across an entry's signature
  // picks, as a 0–100 figure. Higher ⇒ fewer others made the same calls.
  const contrarian: StandoutRow[] = entries
    .map((e) => {
      const rarities: number[] = [];
      const champ = e.picks.knockout?.[104];
      if (champ) rarities.push(1 - share(championCounts, champ));
      for (const code of new Set(
        [e.picks.knockout?.[101], e.picks.knockout?.[102]].filter(Boolean) as string[],
      )) {
        rarities.push(1 - share(finalists, code));
      }
      for (const g of GROUP_LETTERS) {
        const gw = e.picks.groupFirst?.[g];
        if (gw) rarities.push(1 - share(groupCounts[g], gw));
      }
      const score = rarities.length === 0 ? 0 : rarities.reduce((a, b) => a + b, 0) / rarities.length;
      return { entryId: e.entryId, label: e.label, value: Math.round(score * 100) };
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);

  // Upside: only meaningful when the win model produced EV figures.
  const withEv = entries.filter((e): e is StandoutInput & { expectedRemaining: number } => e.expectedRemaining != null);
  const upside: StandoutRow[] = withEv
    .map((e) => ({ entryId: e.entryId, label: e.label, value: e.expectedRemaining }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);

  // Diversity: Gini–Simpson index over the champion distribution — the probability
  // two random brackets named different champions. 0 when the pool is unanimous.
  let sumSq = 0;
  for (const count of championCounts.values()) sumSq += (count / total) ** 2;
  const diversity: PoolDiversity = {
    distinctChampions: championCounts.size,
    index: Math.round((1 - sumSq) * 100) / 100,
  };

  return { totalEntries: total, upside, contrarian, diversity };
}
