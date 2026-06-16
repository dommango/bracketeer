// Pure, DB-free aggregation over a pool's decoded picks. Two consumers:
//  - buildPickAnalytics: pool-wide consensus for the Home analytics card.
//  - entrySelections: one entry's headline picks for the player profile.
// Both read the same `Picks` shape produced by getEntriesWithPicks.

import { TEAMS, GROUPS } from "@/lib/scoring/data";
import type { GroupLetter, Picks } from "@/lib/scoring/types";

const teamName = (code: string | null | undefined): string =>
  code && TEAMS[code] ? TEAMS[code] : "—";

export interface PickTally {
  code: string;
  name: string;
  count: number;
  pct: number; // whole-percent of totalEntries
}

export interface GroupConsensus {
  group: GroupLetter;
  top: PickTally | null;
}

export interface PickAnalytics {
  totalEntries: number;
  champion: { top: PickTally | null; distinctCount: number; field: PickTally[] };
  finalists: PickTally[];
  groupWinners: GroupConsensus[];
  contrarian: PickTally[]; // champions backed by exactly one entry
}

// Tally codes into ranked PickTally[] (count desc, then code asc for determinism).
function tally(codes: (string | null | undefined)[], total: number): PickTally[] {
  const counts = new Map<string, number>();
  for (const c of codes) {
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      name: teamName(code),
      count,
      pct: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export function buildPickAnalytics(allPicks: Picks[]): PickAnalytics {
  const totalEntries = allPicks.length;

  const championField = tally(allPicks.map((p) => p.knockout?.[104]), totalEntries);
  const finalists = tally(
    allPicks.flatMap((p) => [p.knockout?.[101], p.knockout?.[102]]),
    totalEntries,
  );
  const groupWinners: GroupConsensus[] = (Object.keys(GROUPS) as GroupLetter[]).map((group) => ({
    group,
    top: tally(allPicks.map((p) => p.groupFirst?.[group]), totalEntries)[0] ?? null,
  }));
  const contrarian = championField.filter((t) => t.count === 1);

  return {
    totalEntries,
    champion: { top: championField[0] ?? null, distinctCount: championField.length, field: championField },
    finalists,
    groupWinners,
    contrarian,
  };
}

export interface TeamPick {
  code: string | null;
  name: string;
}

export interface SelectionAward {
  label: string;
  value: string;
}

export interface EntrySelections {
  champion: TeamPick;
  finalists: TeamPick[];
  groupWinners: { group: GroupLetter; code: string | null; name: string }[];
  thirdAdvance: { code: string; name: string }[];
  awards: SelectionAward[];
}

const teamPick = (code: string | null | undefined): TeamPick => ({
  code: code || null,
  name: teamName(code),
});

// One entry's headline selections for display on their profile.
export function entrySelections(picks: Picks): EntrySelections {
  return {
    champion: teamPick(picks.knockout?.[104]),
    finalists: [picks.knockout?.[101], picks.knockout?.[102]].map(teamPick),
    groupWinners: (Object.keys(GROUPS) as GroupLetter[]).map((group) => ({
      group,
      ...teamPick(picks.groupFirst?.[group]),
    })),
    thirdAdvance: (picks.thirdAdvance ?? [])
      .filter(Boolean)
      .map((code) => ({ code, name: teamName(code) })),
    awards: [
      { label: "Player of the Tournament", value: picks.awards?.player || "—" },
      { label: "Young Player", value: picks.awards?.young || "—" },
      { label: "Golden Boot", value: picks.awards?.boot || "—" },
      { label: "Goal of the Tournament", value: picks.awards?.goal || "—" },
    ],
  };
}
