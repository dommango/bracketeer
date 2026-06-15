import { describe, it, expect } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import {
  buildApnsProviderJwt,
  isJwtFresh,
  isDeadTokenResponse,
  APNS_JWT_TTL_SEC,
} from "./apns-jwt";

// A throwaway EC P-256 key in PEM form — stands in for an Apple .p8 (same curve).
function p256Pem(): { privateKeyPem: string; publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"] } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicKey };
}

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(seg.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
}

describe("buildApnsProviderJwt", () => {
  it("produces a three-segment JWT with ES256 header and team/iat claims", () => {
    const { privateKeyPem } = p256Pem();
    const jwt = buildApnsProviderJwt({
      keyId: "ABC123KEYID",
      teamId: "TEAM123456",
      privateKeyPem,
      nowSec: 1_700_000_000,
    });
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);

    const header = decodeSegment(parts[0]);
    expect(header).toEqual({ alg: "ES256", kid: "ABC123KEYID" });

    const claims = decodeSegment(parts[1]);
    expect(claims).toEqual({ iss: "TEAM123456", iat: 1_700_000_000 });
  });

  it("signs the header.claims input verifiably with the matching public key (raw r||s)", () => {
    const { privateKeyPem, publicKey } = p256Pem();
    const jwt = buildApnsProviderJwt({
      keyId: "K",
      teamId: "T",
      privateKeyPem,
      nowSec: 1_700_000_000,
    });
    const [h, c, sigB64] = jwt.split(".");
    const signature = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    // ES256 raw signature is exactly 64 bytes (r||s, 32 each).
    expect(signature).toHaveLength(64);

    const ok = verify(
      "sha256",
      Buffer.from(`${h}.${c}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      signature,
    );
    expect(ok).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const { privateKeyPem, publicKey } = p256Pem();
    const jwt = buildApnsProviderJwt({ keyId: "K", teamId: "T", privateKeyPem, nowSec: 1 });
    const [h, c, sigB64] = jwt.split(".");
    const signature = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const ok = verify(
      "sha256",
      Buffer.from(`${h}.${c}tampered`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      signature,
    );
    expect(ok).toBe(false);
  });
});

describe("isJwtFresh", () => {
  it("is fresh within the TTL window and stale at/after it", () => {
    expect(isJwtFresh(1000, 1000)).toBe(true);
    expect(isJwtFresh(1000, 1000 + APNS_JWT_TTL_SEC - 1)).toBe(true);
    expect(isJwtFresh(1000, 1000 + APNS_JWT_TTL_SEC)).toBe(false);
    expect(isJwtFresh(1000, 1000 + APNS_JWT_TTL_SEC + 10_000)).toBe(false);
  });
});

describe("isDeadTokenResponse", () => {
  it("treats 410 as dead regardless of reason", () => {
    expect(isDeadTokenResponse(410, "Unregistered")).toBe(true);
    expect(isDeadTokenResponse(410)).toBe(true);
  });

  it("treats specific 400 reasons as dead", () => {
    expect(isDeadTokenResponse(400, "BadDeviceToken")).toBe(true);
    expect(isDeadTokenResponse(400, "DeviceTokenNotForTopic")).toBe(true);
  });

  it("keeps the token for transient or unrelated failures", () => {
    expect(isDeadTokenResponse(400, "PayloadTooLarge")).toBe(false);
    expect(isDeadTokenResponse(429, "TooManyRequests")).toBe(false);
    expect(isDeadTokenResponse(500, "InternalServerError")).toBe(false);
    expect(isDeadTokenResponse(200)).toBe(false);
    expect(isDeadTokenResponse(400)).toBe(false);
  });
});
