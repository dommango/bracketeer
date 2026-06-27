// Pure player-profile model: a knockout hit-grid, accuracy, the points breakdown
// by category, and the "boldest call" (the entry's most contrarian *correct*
// knockout pick). DB-free; the prisma selector (getProfile) assembles inputs.

import { TEAMS } from "@/lib/scoring/data";
import { roundOf, roundLabel } from "@/lib/pool/rounds";
import { entrySelections, type EntrySelections } from "@/lib/pool/pick-analytics";
import type { Picks, Results } from "@/lib/scoring/types";

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "—";

// Every scored knockout match number, in tournament order (bronze 103 excluded).
const SCORED_KNOCKOUT: number[] = [
  ...Array.from({ length: 16 }, (_, i) => 73 + i), // R32 73–88
  ...Array.from({ length: 8 }, (_, i) => 89 + i), // R16 89–96
  ...Array.from({ length: 4 }, (_, i) => 97 + i), // QF  97–100
  101,
  102, // SF
  104, // Final
];

export type HitResult = "hit" | "miss" | "pending";

export interface KnockoutHit {
  matchNo: number;
  roundCode: string;
  pickCode: string | null;
  pickName: string;
  winnerCode: string | null;
  winnerName: string;
  result: HitResult;
}

export interface Accuracy {
  hits: number;
  decided: number; // decided matches where the entry made a pick
  pct: number; // 0–100
}

export interface CategoryLine {
  key: string;
  label: string;
  points: number;
}

export interface BoldestCall {
  matchNo: number;
  roundCode: string;
  roundLabel: string;
  pickName: string;
  sharePct: number; // % of the pool that also got this pick right
}

// Forward-looking projection for one entry, from the champion + match-odds win
// model (lib/pool/expected-points.ts). Display-only and pick-revealing, so the
// query only attaches it once picks have locked; absent when no odds exist.
export interface EntryProjectionView {
  expectedRemaining: number; // expected points still to come from the knockout rounds
  projectedTotal: number; // actual scored total + expectedRemaining
  projectedRank: number; // projected final placing
}

export interface Profile {
  entryId: string;
  label: string;
  total: number; // live total (official + provisional), to match the leaderboard
  rank: number; // live rank
  projected?: number; // provisional portion of `total`, for the "▲ N live" badge
  entryCount: number;
  accuracy: Accuracy;
  hitGrid: KnockoutHit[];
  categories: CategoryLine[];
  boldest: BoldestCall | null;
  // This entry's headline picks. Pick-revealing UI is hidden until `locked`.
  selections: EntrySelections;
  locked: boolean; // picks revealed (tournament has kicked off / entry locked)
  // Win-model projection; null when the odds integration has no data (or pre-lock).
  projection: EntryProjectionView | null;
}

const CATEGORY_LABELS: [string, string][] = [
  ["group", "Groups"],
  ["thirds", "3rd place"],
  ["r32", "Round of 32"],
  ["r16", "Round of 16"],
  ["qf", "Quarter-finals"],
  ["sf", "Semi-finals"],
  ["final", "Final"],
  ["awards", "Awards"],
];

// How the pool split its winner picks for a match: total picks + count per code.
export interface MatchPickShare {
  total: number;
  byCode: Record<string, number>;
}

export interface ProfileInput {
  entryId: string;
  label: string;
  total: number;
  rank: number;
  projected?: number;
  entryCount: number;
  picks: Picks;
  results: Results;
  breakdown: Record<string, number> | null;
  // Pool-wide winner-pick counts per scored knockout match (for the boldest call).
  pickShareByMatch: Record<number, MatchPickShare>;
  locked: boolean; // whether this entry's picks may be revealed
  // Win-model projection for this entry; null when unavailable (no odds / pre-lock).
  projection?: EntryProjectionView | null;
}

export function buildProfile(input: ProfileInput): Profile {
  const { picks, results } = input;
  const knockout = results.knockout ?? {};

  const hitGrid: KnockoutHit[] = SCORED_KNOCKOUT.map((matchNo) => {
    const winnerCode = knockout[matchNo] || null;
    const pickCode = picks.knockout?.[matchNo] || null;
    let result: HitResult;
    if (!winnerCode) result = "pending";
    else if (pickCode && pickCode === winnerCode) result = "hit";
    else result = "miss";
    return {
      matchNo,
      roundCode: roundOf(matchNo),
      pickCode,
      pickName: teamName(pickCode),
      winnerCode,
      winnerName: teamName(winnerCode),
      result,
    };
  });

  // Accuracy: of the decided matches where the entry actually picked, how many hit.
  const decidedWithPick = hitGrid.filter((h) => h.winnerCode && h.pickCode);
  const hits = decidedWithPick.filter((h) => h.result === "hit").length;
  const decided = decidedWithPick.length;
  const accuracy: Accuracy = {
    hits,
    decided,
    pct: decided === 0 ? 0 : Math.round((hits / decided) * 100),
  };

  const b = input.breakdown ?? {};
  const categories: CategoryLine[] = CATEGORY_LABELS.map(([key, label]) => ({
    key,
    label,
    points: b[key] ?? 0,
  }));

  // Boldest call: the correct knockout pick the fewest others in the pool shared.
  let boldest: BoldestCall | null = null;
  let lowestShare = Infinity;
  for (const h of hitGrid) {
    if (h.result !== "hit" || !h.pickCode) continue;
    const share = input.pickShareByMatch[h.matchNo];
    if (!share || share.total === 0) continue;
    const sharePct = Math.round(((share.byCode[h.pickCode] ?? 0) / share.total) * 100);
    // Prefer the rarer call; break ties toward the later round (heavier match).
    if (sharePct < lowestShare || (sharePct === lowestShare && boldest && h.matchNo > boldest.matchNo)) {
      lowestShare = sharePct;
      boldest = {
        matchNo: h.matchNo,
        roundCode: h.roundCode,
        roundLabel: roundLabel(h.roundCode),
        pickName: h.pickName,
        sharePct,
      };
    }
  }

  return {
    entryId: input.entryId,
    label: input.label,
    total: input.total,
    rank: input.rank,
    projected: input.projected,
    entryCount: input.entryCount,
    accuracy,
    hitGrid,
    categories,
    boldest,
    selections: entrySelections(picks),
    locked: input.locked,
    projection: input.projection ?? null,
  };
}

// Tally pool-wide winner picks per scored knockout match from every entry's picks.
export function tallyPickShare(allPicks: Picks[]): Record<number, MatchPickShare> {
  const out: Record<number, MatchPickShare> = {};
  for (const matchNo of SCORED_KNOCKOUT) out[matchNo] = { total: 0, byCode: {} };
  for (const p of allPicks) {
    for (const matchNo of SCORED_KNOCKOUT) {
      const code = p.knockout?.[matchNo];
      if (!code) continue;
      const share = out[matchNo];
      share.total += 1;
      share.byCode[code] = (share.byCode[code] ?? 0) + 1;
    }
  }
  return out;
}
