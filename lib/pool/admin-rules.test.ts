import { describe, it, expect } from "vitest";
import { normalizePoolName, parseAssignableRole, isProtectedOwner } from "./admin-rules";

describe("normalizePoolName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizePoolName("  The Lads  ")).toBe("The Lads");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(() => normalizePoolName("")).toThrow();
    expect(() => normalizePoolName("   ")).toThrow();
  });

  it("caps the length at 80 characters", () => {
    const long = "a".repeat(200);
    expect(normalizePoolName(long)).toHaveLength(80);
  });
});

describe("parseAssignableRole", () => {
  it("accepts ADMIN and MEMBER", () => {
    expect(parseAssignableRole("ADMIN")).toBe("ADMIN");
    expect(parseAssignableRole("MEMBER")).toBe("MEMBER");
  });

  it("never lets OWNER be assigned (ownership transfer is out of scope)", () => {
    expect(() => parseAssignableRole("OWNER")).toThrow();
  });

  it("rejects anything else", () => {
    expect(() => parseAssignableRole("")).toThrow();
    expect(() => parseAssignableRole("admin")).toThrow();
    expect(() => parseAssignableRole("SUPERUSER")).toThrow();
  });
});

describe("isProtectedOwner", () => {
  it("does not protect ordinary MEMBER/ADMIN rows", () => {
    expect(isProtectedOwner("MEMBER", "u1", "owner")).toBe(false);
    expect(isProtectedOwner("ADMIN", "u1", "owner")).toBe(false);
  });

  it("protects a row whose role is OWNER", () => {
    expect(isProtectedOwner("OWNER", "u1", "owner")).toBe(true);
  });

  it("protects the pool owner even if their row's role isn't OWNER", () => {
    expect(isProtectedOwner("ADMIN", "owner", "owner")).toBe(true);
  });
});
