import { describe, it, expect } from "vitest";
import {
  snapshotDue,
  snapshotKickoffRange,
  EARLY_WINDOW_START_MS,
  PRE_WINDOW_START_MS,
  HALF_WINDOW_START_MS,
  HALF_WINDOW_END_MS,
} from "./schedule";

const KO = new Date("2026-06-18T19:00:00Z").getTime();
const at = (offsetMs: number) => KO + offsetMs;
const MIN = 60_000;

describe("snapshotDue", () => {
  it("takes no snapshot well before the early window opens (>18 h out)", () => {
    expect(snapshotDue(at(EARLY_WINDOW_START_MS - MIN), KO, null)).toBeNull();
  });

  it("takes the early snapshot once the 18-h window opens and odds are unset", () => {
    expect(snapshotDue(at(EARLY_WINDOW_START_MS), KO, null)).toBe("early");
    expect(snapshotDue(at(-90 * MIN), KO, null)).toBe("early");
  });

  it("fires the early snapshot only once: a row stamped inside the window is not re-due", () => {
    const justFetched = at(EARLY_WINDOW_START_MS + MIN);
    expect(snapshotDue(at(-90 * MIN), KO, justFetched)).toBeNull();
  });

  it("still fires pre after an early row: the early line predates the pre window", () => {
    const earlyRow = at(-6 * 60 * MIN); // captured in the early window, hours before KO
    expect(snapshotDue(at(-10 * MIN), KO, earlyRow)).toBe("pre");
  });

  it("takes the pre snapshot once the 30-min window opens and odds are unset", () => {
    expect(snapshotDue(at(PRE_WINDOW_START_MS), KO, null)).toBe("pre");
    expect(snapshotDue(at(-10 * MIN), KO, null)).toBe("pre");
  });

  it("fires the pre snapshot only once: a row stamped inside the window is not re-due", () => {
    const justFetched = at(-29 * MIN); // captured 1 min into the window
    expect(snapshotDue(at(-10 * MIN), KO, justFetched)).toBeNull();
  });

  it("still fires pre when the stored odds predate the window (stale slate from hours ago)", () => {
    const old = at(-6 * 60 * MIN);
    expect(snapshotDue(at(-10 * MIN), KO, old)).toBe("pre");
  });

  it("takes no snapshot in the first-half gap between the two windows", () => {
    // Kickoff through ~45 min: pre already taken, half not yet open.
    expect(snapshotDue(at(20 * MIN), KO, at(-25 * MIN))).toBeNull();
  });

  it("takes the half snapshot once the halftime window opens, given a pre-window row", () => {
    const preRow = at(-25 * MIN); // the pre snapshot, older than halfStart
    expect(snapshotDue(at(HALF_WINDOW_START_MS), KO, preRow)).toBe("half");
    expect(snapshotDue(at(55 * MIN), KO, preRow)).toBe("half");
  });

  it("fires the half snapshot only once: a row stamped inside the halftime window is not re-due", () => {
    const halfFetched = at(46 * MIN);
    expect(snapshotDue(at(55 * MIN), KO, halfFetched)).toBeNull();
  });

  it("takes no snapshot after the halftime window closes (odds are meaningless near FT)", () => {
    expect(snapshotDue(at(HALF_WINDOW_END_MS + MIN), KO, at(-25 * MIN))).toBeNull();
    expect(snapshotDue(at(120 * MIN), KO, at(-25 * MIN))).toBeNull();
  });
});

describe("snapshotKickoffRange", () => {
  it("brackets kickoffs whose early-, pre- or half-window could be open right now", () => {
    const now = at(0);
    const { gt, lt } = snapshotKickoffRange(now);
    // A match kicking off up to 18 h from now (early-window open) is included…
    expect(lt.getTime()).toBe(now - EARLY_WINDOW_START_MS);
    // …and one that kicked off up to 75 min ago (halftime window open) too.
    expect(gt.getTime()).toBe(now - HALF_WINDOW_END_MS);
    expect(gt.getTime()).toBeLessThan(lt.getTime());
  });
});
