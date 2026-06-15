// APNs token-based auth — the pure, env-free crypto half (unit-tested).
// Apple authenticates a provider with a short-lived ES256 JWT signed by the
// account's .p8 key. Kept dependency-free (node:crypto only) so it can be tested
// without real Apple credentials or the env module.

import { createPrivateKey, sign } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface ProviderJwtInput {
  keyId: string;
  teamId: string;
  // The .p8 private key contents (PEM, EC P-256).
  privateKeyPem: string;
  // Issued-at, unix seconds. Injected so tests are deterministic.
  nowSec: number;
}

// Build a signed APNs provider JWT. Header carries the key id (kid) + ES256;
// the only claims Apple wants are the team id (iss) and issued-at (iat). The
// signature is the JOSE raw r||s form (ieee-p1363), not DER — Apple rejects DER.
export function buildApnsProviderJwt(input: ProviderJwtInput): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: input.keyId })));
  const claims = base64url(Buffer.from(JSON.stringify({ iss: input.teamId, iat: input.nowSec })));
  const signingInput = `${header}.${claims}`;
  const key = createPrivateKey(input.privateKeyPem);
  const signature = sign("sha256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64url(signature)}`;
}

// Apple requires the provider token be refreshed no more often than every 20
// minutes and no less often than every 60. Reuse one well inside that window.
export const APNS_JWT_TTL_SEC = 50 * 60;

// Given a cached JWT minted at `mintedSec`, is it still safe to reuse at `nowSec`?
export function isJwtFresh(mintedSec: number, nowSec: number): boolean {
  return nowSec - mintedSec < APNS_JWT_TTL_SEC;
}

// Classify an APNs per-device response. Apple returns 410 (with reason
// "Unregistered") when the app was uninstalled, and 400 BadDeviceToken /
// DeviceTokenNotForTopic for a token that can never succeed — all mean "drop it".
// Transient failures (429, 5xx) are NOT dead: keep the token and retry later.
const DEAD_REASONS = new Set(["Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"]);

export function isDeadTokenResponse(status: number, reason?: string | null): boolean {
  if (status === 410) return true;
  if (status === 400 && reason) return DEAD_REASONS.has(reason);
  return false;
}
