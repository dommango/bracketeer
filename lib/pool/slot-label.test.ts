import { describe, it, expect } from "vitest";
import { slotLabel, KNOCKOUT_SLOT_REFS } from "./slot-label";

describe("slotLabel", () => {
  it("keeps group winner / runner-up refs", () => {
    expect(slotLabel("1A")).toBe("1A");
    expect(slotLabel("2F")).toBe("2F");
  });

  it("names the advancing third-place pool by its candidate groups", () => {
    expect(slotLabel("3rd:ABCDF")).toBe("3rd A/B/C/D/F");
    expect(slotLabel("3rd")).toBe("3rd");
  });

  it("labels winners by their source round + index", () => {
    expect(slotLabel("W73")).toBe("R32-1");
    expect(slotLabel("W89")).toBe("R16-1");
    expect(slotLabel("W97")).toBe("QF1");
    expect(slotLabel("W101")).toBe("SF1");
    expect(slotLabel("W102")).toBe("SF2");
  });

  it("marks losers (bronze feeders)", () => {
    expect(slotLabel("L101")).toBe("SF1 L");
  });

  it("falls back to TBD for empty and passes through unknowns", () => {
    expect(slotLabel(null)).toBe("TBD");
    expect(slotLabel(undefined)).toBe("TBD");
    expect(slotLabel("???")).toBe("???");
  });
});

describe("KNOCKOUT_SLOT_REFS", () => {
  it("covers every knockout match 73–104", () => {
    for (let no = 73; no <= 104; no++) {
      expect(KNOCKOUT_SLOT_REFS[no]).toBeDefined();
      expect(KNOCKOUT_SLOT_REFS[no]).toHaveLength(2);
    }
  });

  it("the final is fed by the two semi-final winners", () => {
    expect(KNOCKOUT_SLOT_REFS[104].map(slotLabel)).toEqual(["SF1", "SF2"]);
  });

  it("R32 uses group-position refs", () => {
    // Every R32 ref is a group slot (1A/2B) or a third-place pool (3rd A/B/…).
    for (const m of [73, 80, 88]) {
      for (const ref of KNOCKOUT_SLOT_REFS[m]) {
        expect(slotLabel(ref)).toMatch(/^([12][A-L]|3rd( [A-L](\/[A-L])*)?)$/);
      }
    }
  });
});
