import { describe, it, expect } from "vitest";
import { groupOverlayBreakdown } from "./group-overlay";
import { provisionalGroupDelta } from "./group-provisional";
import type { GroupTableRow } from "./group-table";
import { DEFAULT_SCORING } from "@/lib/scoring/score";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";

// Pull stable team codes from the static GROUPS map so the test reads against
// real data without hardcoding country codes.
const [A1, A2, A3] = GROUPS.A; // group A: 1st/2nd/3rd seeds
const [B1, B2, B3, B4] = GROUPS.B;
const [C1, C2] = GROUPS.C;
const [D1] = GROUPS.D;

// Minimal live table: codes in finishing order → ranks 1..n. Only code+rank are
// read by the breakdown (completion is driven by the completedGroups set).
function ranked(codes: string[]): GroupTableRow[] {
  return codes.map((code, i) => ({
    code, played: 3, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
    rank: i + 1, tied: false, form: "",
  }));
}

const cfg = DEFAULT_SCORING;

// Official key: group A is admin-finalized; everything else is open.
const official: Results = {
  ...emptyPicks(),
  groupFirst: { A: A1 },
  groupSecond: { A: A2 },
  thirdAdvance: [],
  finalGoals: null,
};

// Live overlay: A unchanged (finalized), B & C have provisional standings, D has
// none yet. B3 / A3 sit in the live third-place advancers.
const overlay: Results = {
  ...emptyPicks(),
  groupFirst: { A: A1, B: B1, C: C1 },
  groupSecond: { A: A2, B: B2, C: C2 },
  thirdAdvance: [A3, B3],
  finalGoals: null,
};

describe("groupOverlayBreakdown", () => {
  it("scores a finalized group with zero live delta", () => {
    const picks: Picks = { ...emptyPicks(), groupFirst: { A: A1 }, groupSecond: { A: A2 } };
    const out = groupOverlayBreakdown(picks, official, overlay, cfg);
    const a = out.groups.find((g) => g.group === "A")!;
    expect(a.finalized).toBe(true);
    expect(a.first.status).toBe("exact");
    expect(a.second.status).toBe("exact");
    expect(a.officialPoints).toBe(cfg.groupExact * 2);
    expect(a.overlayPoints).toBe(cfg.groupExact * 2);
    expect(a.liveDelta).toBe(0);
  });

  it("classifies exact / wrong_slot / pending against the live overlay", () => {
    const picks: Picks = {
      ...emptyPicks(),
      groupFirst: { B: B1, C: C2, D: D1 }, // B exact, C wrong_slot (right team wrong slot), D pending
      groupSecond: { B: B4 }, // B 2nd is a live miss, but B isn't decided yet → pending
    };
    const out = groupOverlayBreakdown(picks, official, overlay, cfg);
    const b = out.groups.find((g) => g.group === "B")!;
    const c = out.groups.find((g) => g.group === "C")!;
    const d = out.groups.find((g) => g.group === "D")!;
    expect(b.first.status).toBe("exact");
    // B4 is out of the spots on the live table, but the group is still in progress —
    // it can still climb, so it's "pending", never "eliminated" mid-stage.
    expect(b.second.status).toBe("pending");
    expect(c.first.status).toBe("wrong_slot");
    expect(d.first.status).toBe("pending");
    // Per-slot points reflect the outcome and sum to the group's overlayPoints.
    expect(b.first.points).toBe(cfg.groupExact);
    expect(b.second.points).toBe(0);
    expect(c.first.points).toBe(cfg.groupPartial);
    expect(d.first.points).toBe(0);
    // B: exact 1st (live) → liveDelta = groupExact; C: wrong_slot 1st → groupPartial.
    expect(b.liveDelta).toBe(cfg.groupExact);
    expect(c.liveDelta).toBe(cfg.groupPartial);
    expect(b.finalized).toBe(false);
  });

  it("marks a pick eliminated only once its group is FINAL-complete", () => {
    // B4 is the user's 1st pick but sits 4th on the table. While B is in progress
    // it's "pending"; once all of B's matches go FINAL, 4th can't qualify → "miss".
    const picks: Picks = { ...emptyPicks(), groupFirst: { B: B4 } };
    const tables = { B: ranked([B1, B2, B3, B4]) };

    const live = groupOverlayBreakdown(picks, official, overlay, cfg, tables, new Set());
    expect(live.groups.find((g) => g.group === "B")!.first.status).toBe("pending");

    const done = groupOverlayBreakdown(picks, official, overlay, cfg, tables, new Set(["B"]));
    expect(done.groups.find((g) => g.group === "B")!.first.status).toBe("miss");
  });

  it("keeps a 3rd-place pick pending until the whole stage settles (best-3rd is cross-group)", () => {
    // B3 is picked 1st but sits 3rd and is NOT in the live best-3rd advancers.
    const noThirds: Results = { ...overlay, thirdAdvance: [] };
    const picks: Picks = { ...emptyPicks(), groupFirst: { B: B3 } };
    const tables = { B: ranked([B1, B2, B3, B4]) };

    // B complete, but other groups aren't → 3rd could still back in as a best-3rd.
    const groupDone = groupOverlayBreakdown(picks, official, noThirds, cfg, tables, new Set(["B"]));
    expect(groupDone.groups.find((g) => g.group === "B")!.first.status).toBe("pending");

    // Whole stage settled (every group FINAL) and B3 isn't a best-3rd → eliminated.
    const allGroups = new Set(Object.keys(GROUPS));
    const out = groupOverlayBreakdown(picks, official, noThirds, cfg, tables, allGroups);
    expect(out.groups.find((g) => g.group === "B")!.first.status).toBe("miss");
  });

  it("flags a top-2 pick that is only a 3rd-place advancer as 'third' (partial points)", () => {
    const picks: Picks = {
      ...emptyPicks(),
      groupFirst: { B: A3 }, // A3 is a live 3rd advancer → 'third', not exact/miss/wrong_slot
      thirdAdvance: [A3, B3],
    };
    const out = groupOverlayBreakdown(picks, official, overlay, cfg);
    const b = out.groups.find((g) => g.group === "B")!;
    expect(b.first.status).toBe("third");
    expect(b.first.points).toBe(cfg.groupPartial); // 'third' scores partial, like wrong_slot
    expect(b.liveDelta).toBe(cfg.groupPartial); // still partial credit
    expect(out.thirdsLiveDelta).toBe(cfg.thirdAdvancer * 2);
  });

  it("reconciles totalLiveDelta with provisionalGroupDelta", () => {
    const picks: Picks = {
      ...emptyPicks(),
      groupFirst: { A: A1, B: B1, C: C2, D: D1 },
      groupSecond: { A: A2, B: A1 },
      thirdAdvance: [A3, B3, C1],
    };
    const out = groupOverlayBreakdown(picks, official, overlay, cfg);
    expect(out.totalLiveDelta).toBe(provisionalGroupDelta(picks, official, overlay, cfg));
  });

  it("returns all-pending, zero deltas for empty picks", () => {
    const out = groupOverlayBreakdown(emptyPicks(), official, overlay, cfg);
    expect(out.groups.every((g) => g.first.status === "pending" && g.second.status === "pending")).toBe(true);
    expect(out.totalLiveDelta).toBe(0);
    expect(out.thirdsLiveDelta).toBe(0);
  });
});
