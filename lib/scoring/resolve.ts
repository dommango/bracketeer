// Bracket slot resolution — ported verbatim from "WorldCup2026Bracket Revised.html".
//
// Third-place teams are assigned to R32 slots by BACKTRACKING over the slots
// in match-id order, trying teams in thirdAdvance order. The original tool
// used greedy first-eligible, which failed to seat many valid pick sets
// (leaving slots empty and wiping winner picks); the revised tool fixed it.
// When no full assignment exists (e.g. a partial draft), each slot falls back
// to the first eligible team from the full list, exactly as the revised tool
// renders it. Scoring (scorePicks) never reads this resolution — points
// compare picked winner codes directly — so this affects display and the
// in-app builder only.

import { GROUPS, R32 } from "./data";
import { THIRD_PLACE_TABLE, THIRD_PLACE_MATCH_ORDER } from "./third-place-table";
import type { GroupLetter, Picks, TeamCode } from "./types";

export type ResolvedR32 = Record<number, { a: TeamCode | null; b: TeamCode | null }>;

function getTeamGroupMap(): Record<TeamCode, GroupLetter> {
  const teamGroup: Record<TeamCode, GroupLetter> = {};
  for (const [g, teams] of Object.entries(GROUPS))
    for (const t of teams) teamGroup[t] = g;
  return teamGroup;
}

interface ThirdSlot {
  key: string;
  groups: GroupLetter[];
}

function collectThirdPlaceSlots(): ThirdSlot[] {
  const slots: ThirdSlot[] = [];
  for (const m of R32) {
    for (const side of ["a", "b"] as const) {
      const slot = m[side];
      if ("third" in slot) slots.push({ key: `${m.id}${side}`, groups: slot.third });
    }
  }
  return slots;
}

function eligibleThirdTeams(
  groupList: GroupLetter[],
  thirdTeams: TeamCode[],
  teamGroup: Record<TeamCode, GroupLetter>,
): TeamCode[] {
  return thirdTeams.filter((t) => groupList.includes(teamGroup[t]));
}

// The official FIFA seating for a COMPLETE set of eight third-place teams, via
// the Annex C placement table (third-place-table.ts). Returns null unless the
// eight teams come from eight distinct groups that form a real qualifying
// combination — i.e. a partial/degenerate draft, which falls back to
// backtracking below. Keyed by slot (`${matchId}b`, matching resolveR32Slots).
function officialThirdAssignment(
  thirdTeams: TeamCode[],
  teamGroup: Record<TeamCode, GroupLetter>,
): Record<string, TeamCode> | null {
  if (thirdTeams.length !== 8) return null;
  const groupToTeam: Record<string, TeamCode> = {};
  for (const t of thirdTeams) groupToTeam[teamGroup[t]] = t;
  const key = Object.keys(groupToTeam).sort().join("");
  if (key.length !== 8) return null; // two thirds shared a group — not a real combo
  const value = THIRD_PLACE_TABLE[key];
  if (!value) return null;
  // Derive each match's third-slot side from the R32 data (not assuming "b"), so
  // the slot key matches resolveR32Slots even if a third ever sits on the a side.
  const sideOf: Record<number, "a" | "b"> = {};
  for (const m of R32) {
    if ("third" in m.a) sideOf[m.id] = "a";
    else if ("third" in m.b) sideOf[m.id] = "b";
  }
  const assignment: Record<string, TeamCode> = {};
  THIRD_PLACE_MATCH_ORDER.forEach((mid, i) => {
    assignment[`${mid}${sideOf[mid]}`] = groupToTeam[value[i]];
  });
  return assignment;
}

// Assign each picked 3rd-place team to exactly one R32 slot. A complete set of 8
// uses FIFA's official placement table (the real bracket + full user brackets);
// partial drafts fall back to backtracking (greedy first-fit strands many valid
// sets, so we search for a full assignment when one exists).
function assignThirdPlaceTeams(
  thirdTeams: TeamCode[],
  teamGroup: Record<TeamCode, GroupLetter>,
): Record<string, TeamCode> {
  const official = officialThirdAssignment(thirdTeams, teamGroup);
  if (official) return official;

  const slots = collectThirdPlaceSlots();
  const assignment: Record<string, TeamCode> = {};
  const used = new Set<TeamCode>();

  function backtrack(i: number): boolean {
    if (i >= slots.length) return thirdTeams.length === slots.length;
    const slot = slots[i];
    for (const t of thirdTeams) {
      if (used.has(t)) continue;
      if (!slot.groups.includes(teamGroup[t])) continue;
      assignment[slot.key] = t;
      used.add(t);
      if (backtrack(i + 1)) return true;
      used.delete(t);
      delete assignment[slot.key];
    }
    return false;
  }

  if (!(thirdTeams.length === slots.length && backtrack(0))) {
    return {};
  }
  return assignment;
}

// Resolve every R32 slot to a concrete team code (or null) from a set of picks.
export function resolveR32Slots(picks: Picks): ResolvedR32 {
  const thirdTeams = (picks.thirdAdvance || []).slice();
  const teamGroup = getTeamGroupMap();
  const assignment = assignThirdPlaceTeams(thirdTeams, teamGroup);

  const resolved: ResolvedR32 = {};
  for (const m of R32) {
    const resolveSlot = (
      slot: (typeof m)["a"],
      side: "a" | "b",
    ): TeamCode | null => {
      if ("third" in slot) {
        const key = `${m.id}${side}`;
        if (assignment[key]) return assignment[key];
        const elig = eligibleThirdTeams(slot.third, thirdTeams, teamGroup);
        return elig.length ? elig[0] : null;
      }
      const g = slot.group;
      return slot.pos === 1
        ? picks.groupFirst[g] || null
        : picks.groupSecond[g] || null;
    };
    resolved[m.id] = {
      a: resolveSlot(m.a, "a"),
      b: resolveSlot(m.b, "b"),
    };
  }
  return resolved;
}

// Winner of any match, per a set of picks (knockout map holds the picked code).
export function winnerOf(picks: Picks, matchId: number): TeamCode | null {
  return picks.knockout[matchId] || null;
}

// Loser of a match given resolved R32 teams (used for bronze-final feeders).
export function loserOf(
  picks: Picks,
  matchId: number,
  resolvedTeams: ResolvedR32,
): TeamCode | null {
  const w = winnerOf(picks, matchId);
  if (!w) return null;
  const ab = resolvedTeams[matchId];
  if (!ab) return null;
  if (ab.a === w) return ab.b;
  if (ab.b === w) return ab.a;
  return null;
}
