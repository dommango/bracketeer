import { describe, it, expect } from "vitest";
import { groupOverlayBreakdown } from "./group-overlay";
import { provisionalGroupDelta } from "./group-provisional";
import { DEFAULT_SCORING } from "@/lib/scoring/score";
import { GROUPS } from "@/lib/scoring/data";
import { emptyPicks, type Picks, type Results } from "@/lib/scoring/types";

// Pull stable team codes from the static GROUPS map so the test reads against
// real data without hardcoding country codes.
const [A1, A2, A3] = GROUPS.A; // group A: 1st/2nd/3rd seeds
const [B1, B2, B3] = GROUPS.B;
const [C1, C2] = GROUPS.C;
const [D1] = GROUPS.D;

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

  it("classifies exact / wrong_slot / miss / pending against the live overlay", () => {
    const picks: Picks = {
      ...emptyPicks(),
      groupFirst: { B: B1, C: C2, D: D1 }, // B exact, C wrong_slot (right team wrong slot), D pending
      groupSecond: { B: A1 }, // B 2nd is a miss (A1 isn't in B's live standings/thirds)
    };
    const out = groupOverlayBreakdown(picks, official, overlay, cfg);
    const b = out.groups.find((g) => g.group === "B")!;
    const c = out.groups.find((g) => g.group === "C")!;
    const d = out.groups.find((g) => g.group === "D")!;
    expect(b.first.status).toBe("exact");
    expect(b.second.status).toBe("miss");
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
