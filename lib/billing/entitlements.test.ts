import { describe, it, expect } from "vitest";
import {
  FREE_MEMBER_CAP,
  isPremium,
  memberCap,
  canAddMember,
  remainingSlots,
} from "./entitlements";

describe("isPremium", () => {
  it("is true only for PREMIUM", () => {
    expect(isPremium("PREMIUM")).toBe(true);
    expect(isPremium("FREE")).toBe(false);
  });
});

describe("memberCap", () => {
  it("caps FREE at FREE_MEMBER_CAP and leaves PREMIUM uncapped", () => {
    expect(memberCap("FREE")).toBe(FREE_MEMBER_CAP);
    expect(memberCap("PREMIUM")).toBeNull();
  });
});

describe("canAddMember", () => {
  it("admits members on a FREE pool up to (not including) the cap", () => {
    expect(canAddMember("FREE", FREE_MEMBER_CAP - 1)).toBe(true);
    expect(canAddMember("FREE", FREE_MEMBER_CAP)).toBe(false);
    expect(canAddMember("FREE", FREE_MEMBER_CAP + 5)).toBe(false);
  });

  it("always admits members on a PREMIUM pool", () => {
    expect(canAddMember("PREMIUM", 0)).toBe(true);
    expect(canAddMember("PREMIUM", FREE_MEMBER_CAP * 100)).toBe(true);
  });
});

describe("remainingSlots", () => {
  it("counts down to zero on FREE and never goes negative", () => {
    expect(remainingSlots("FREE", 0)).toBe(FREE_MEMBER_CAP);
    expect(remainingSlots("FREE", FREE_MEMBER_CAP)).toBe(0);
    expect(remainingSlots("FREE", FREE_MEMBER_CAP + 3)).toBe(0);
  });

  it("is null (unlimited) for PREMIUM", () => {
    expect(remainingSlots("PREMIUM", 999)).toBeNull();
  });
});
