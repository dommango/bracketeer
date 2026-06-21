// Per-group attribution of a bracket's group-stage points, for the home-page
// overlay. Pure and DB-free. NOT part of the byte-parity scoring engine in
// lib/scoring — it only reproduces score.ts's group 1st/2nd rule one group at a
// time so the page can SHOW where points come from. The per-group + thirds live
// deltas sum, by construction, to provisionalGroupDelta (group-provisional.ts),
// so this view can never disagree with the leaderboard's ▲ group total.

import { GROUPS } from "@/lib/scoring/data";
import type { Picks, Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";

// Two distinct partial-credit cases are kept separate so the UI can explain each:
// "wrong_slot" = right team in the other top-2 slot; "third" = a top-2 pick that is
// currently a best-3rd qualifier. Both award groupPartial in scorePicks.
export type PickStatus = "exact" | "wrong_slot" | "third" | "miss" | "pending";

export interface GroupPickCell {
  code: string | null;
  status: PickStatus;
  points: number; // live points this slot pick currently earns under the overlay
}

export interface GroupOverlayCell {
  group: string;
  first: GroupPickCell;
  second: GroupPickCell;
  officialPoints: number; // group 1st/2nd points under the official answer key
  overlayPoints: number; // group 1st/2nd points under the live overlay
  liveDelta: number; // overlayPoints - officialPoints (the provisional portion)
  finalized: boolean; // admin has set this group's official 1st place
}

export interface GroupOverlayBreakdown {
  groups: GroupOverlayCell[];
  thirdsLiveDelta: number;
  thirdAdvancerPoints: number; // points a correct best-3rd advancer pick is worth (cfg)
  totalLiveDelta: number; // === provisionalGroupDelta(picks, official, overlay, cfg)
}

// Points for a single group's 1st/2nd picks against one results object. Mirrors
// the GROUP branch of scorePicks (lib/scoring/score.ts) restricted to group `g`.
function groupPositionPoints(
  picks: Picks,
  results: Results,
  g: string,
  cfg: ScoringConfig,
): number {
  let pts = 0;
  const p1 = picks.groupFirst?.[g];
  const p2 = picks.groupSecond?.[g];
  const r1 = results.groupFirst?.[g];
  const r2 = results.groupSecond?.[g];
  const rThirds = new Set(results.thirdAdvance || []);
  if (p1 && r1) {
    if (p1 === r1) pts += cfg.groupExact;
    else if (p1 === r2) pts += cfg.groupPartial;
    else if (rThirds.has(p1)) pts += cfg.groupPartial;
  }
  if (p2 && r2) {
    if (p2 === r2) pts += cfg.groupExact;
    else if (p2 === r1) pts += cfg.groupPartial;
    else if (rThirds.has(p2)) pts += cfg.groupPartial;
  }
  return pts;
}

// 3rd-place advancer points against one results object. Mirrors the THIRDS
// branch of scorePicks.
function thirdsPoints(picks: Picks, results: Results, cfg: ScoringConfig): number {
  const r = new Set(results.thirdAdvance || []);
  let pts = 0;
  for (const t of new Set(picks.thirdAdvance || [])) {
    if (r.has(t)) pts += cfg.thirdAdvancer;
  }
  return pts;
}

// Status of one slot pick against the live overlay standings. "pending" while
// the group has no provisional standings yet (or its target rank is still tied);
// "partial" covers right-team-wrong-slot and a correct 3rd-place advancer.
function cellStatus(
  pick: string | undefined,
  overlay: Results,
  g: string,
  slot: "first" | "second",
): PickStatus {
  if (!pick) return "pending";
  const oFirst = overlay.groupFirst?.[g];
  const oSecond = overlay.groupSecond?.[g];
  if (!oFirst && !oSecond) return "pending";
  const target = slot === "first" ? oFirst : oSecond;
  const other = slot === "first" ? oSecond : oFirst;
  if (target && pick === target) return "exact";
  if (other && pick === other) return "wrong_slot"; // right team, other top-2 slot
  if (new Set(overlay.thirdAdvance || []).has(pick)) return "third"; // advancing as a best-3rd
  if (!target) return "pending"; // this rank is still tied/unresolved
  return "miss";
}

export function groupOverlayBreakdown(
  picks: Picks,
  official: Results,
  overlay: Results,
  cfg: ScoringConfig,
): GroupOverlayBreakdown {
  // Per-status live points; the two slot values sum to the group's overlayPoints.
  const slotPoints = (status: PickStatus): number =>
    status === "exact"
      ? cfg.groupExact
      : status === "wrong_slot" || status === "third"
        ? cfg.groupPartial
        : 0;

  const groups: GroupOverlayCell[] = Object.keys(GROUPS).map((g) => {
    const officialPoints = groupPositionPoints(picks, official, g, cfg);
    const overlayPoints = groupPositionPoints(picks, overlay, g, cfg);
    const first = ((): GroupPickCell => {
      const status = cellStatus(picks.groupFirst?.[g], overlay, g, "first");
      return { code: picks.groupFirst?.[g] ?? null, status, points: slotPoints(status) };
    })();
    const second = ((): GroupPickCell => {
      const status = cellStatus(picks.groupSecond?.[g], overlay, g, "second");
      return { code: picks.groupSecond?.[g] ?? null, status, points: slotPoints(status) };
    })();
    return {
      group: g,
      first,
      second,
      officialPoints,
      overlayPoints,
      liveDelta: overlayPoints - officialPoints,
      finalized: Boolean(official.groupFirst?.[g]),
    };
  });

  const thirdsLiveDelta = thirdsPoints(picks, overlay, cfg) - thirdsPoints(picks, official, cfg);
  const totalLiveDelta = groups.reduce((sum, c) => sum + c.liveDelta, 0) + thirdsLiveDelta;

  return { groups, thirdsLiveDelta, thirdAdvancerPoints: cfg.thirdAdvancer, totalLiveDelta };
}
