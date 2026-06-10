// Pure pick-share tallying — no DB imports, so it stays unit-testable without an
// environment (matching the rest of lib/pool's pure helpers). The DB-backed
// queries live in pickSplit.ts and reuse this.

import { TEAMS } from "@/lib/scoring/data";

export interface PickShare {
  code: string;
  name: string;
  count: number;
  pct: number; // share of entries that made a pick for this match, 0–100
  isContestant: boolean; // one of the two teams the bracket says contest the match
  isActualWinner: boolean;
  entryLabels: string[];
}

export interface RawWinnerPick {
  code: string;
  label: string; // contestant label, for the "who picked it" list
}

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "TBD";

// Turn raw winner picks for one match into a sorted share list.
export function tallyShares(
  picks: RawWinnerPick[],
  resolved: { home: string | null; away: string | null; winner: string | null },
): { totalPicks: number; shares: PickShare[] } {
  const byCode = new Map<string, string[]>();
  for (const p of picks) {
    if (!p.code) continue;
    const labels = byCode.get(p.code) ?? [];
    labels.push(p.label);
    byCode.set(p.code, labels);
  }

  const total = [...byCode.values()].reduce((n, l) => n + l.length, 0);
  const shares: PickShare[] = [...byCode.entries()]
    .map(([code, labels]) => ({
      code,
      name: teamName(code),
      count: labels.length,
      pct: total ? Math.round((labels.length / total) * 100) : 0,
      isContestant: code === resolved.home || code === resolved.away,
      isActualWinner: Boolean(resolved.winner) && code === resolved.winner,
      entryLabels: labels.sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { totalPicks: total, shares };
}
