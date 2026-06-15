import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  isInviteValid,
  inviteUrl,
  INVITE_TOKEN_BYTES,
} from "./invite-token";

describe("generateInviteToken", () => {
  it("produces url-safe tokens (base64url charset only)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("is effectively unique across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateInviteToken());
    expect(seen.size).toBe(1000);
  });

  it("scales length with the byte count", () => {
    expect(generateInviteToken(INVITE_TOKEN_BYTES).length).toBeGreaterThanOrEqual(32);
    expect(generateInviteToken(3).length).toBeLessThan(generateInviteToken(30).length);
  });
});

describe("isInviteValid", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("is valid when unaccepted and unexpired", () => {
    expect(isInviteValid({ acceptedAt: null, expiresAt: null }, now)).toBe(true);
    expect(
      isInviteValid({ acceptedAt: null, expiresAt: new Date("2026-06-20T00:00:00Z") }, now),
    ).toBe(true);
  });

  it("is invalid once accepted (single-use)", () => {
    expect(isInviteValid({ acceptedAt: new Date("2026-06-14T00:00:00Z"), expiresAt: null }, now)).toBe(
      false,
    );
  });

  it("is invalid at/after expiry", () => {
    expect(
      isInviteValid({ acceptedAt: null, expiresAt: new Date("2026-06-15T12:00:00Z") }, now),
    ).toBe(false);
    expect(
      isInviteValid({ acceptedAt: null, expiresAt: new Date("2026-06-10T00:00:00Z") }, now),
    ).toBe(false);
  });
});

describe("inviteUrl", () => {
  it("builds an /invite/<token> link and trims trailing slashes from the base", () => {
    expect(inviteUrl("https://hessfest.app", "tok123")).toBe("https://hessfest.app/invite/tok123");
    expect(inviteUrl("https://hessfest.app/", "tok123")).toBe("https://hessfest.app/invite/tok123");
  });
});
