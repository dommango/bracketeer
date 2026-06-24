import { describe, it, expect } from "vitest";
import { publicLabel, anonHandle } from "./public-label";

describe("publicLabel", () => {
  it("uses a real name when present", () => {
    expect(publicLabel("Dom", "user-1")).toBe("Dom");
    expect(publicLabel("  Dom  ", "user-1")).toBe("Dom");
  });

  it("never surfaces an email — falls back to an anonymous handle", () => {
    expect(publicLabel("dom@gmail.com", "user-1")).toBe(anonHandle("user-1"));
    expect(publicLabel("bob (bob@x.com)", "user-1")).toBe(anonHandle("user-1")); // email substring
    expect(publicLabel("", "user-1")).toBe(anonHandle("user-1"));
    expect(publicLabel(null, "user-1")).toBe(anonHandle("user-1"));
    expect(publicLabel(undefined, "user-1")).toBe(anonHandle("user-1"));
  });

  it("produces a stable handle per user id", () => {
    expect(anonHandle("user-1")).toBe(anonHandle("user-1"));
    expect(anonHandle("user-1")).not.toBe(anonHandle("user-2"));
    expect(anonHandle("user-1")).toMatch(/^Player-[0-9a-f]{6}$/);
  });
});
