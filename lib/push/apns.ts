// APNs sender — the env + network half. Speaks HTTP/2 directly (node:http2),
// because Apple's push gateway is HTTP/2-only and undici's fetch can't do it.
// All callers must guard on pushEnabled (lib/env); this no-ops when unset so a
// keyless deploy never tries to talk to Apple.

import http2 from "node:http2";
import { env, pushEnabled } from "@/lib/env";
import { buildApnsProviderJwt, isJwtFresh } from "./apns-jwt";

const PROD_HOST = "https://api.push.apple.com";
const SANDBOX_HOST = "https://api.development.push.apple.com";

export interface ApnsPayload {
  title: string;
  body: string;
  // Optional deep-link / routing hints delivered in the custom payload.
  data?: Record<string, string>;
}

export interface ApnsResult {
  token: string;
  status: number;
  reason?: string;
}

// One cached provider JWT, reused until it ages out of Apple's window.
let cachedJwt: { value: string; mintedSec: number } | null = null;

function providerJwt(nowSec: number): string {
  if (cachedJwt && isJwtFresh(cachedJwt.mintedSec, nowSec)) return cachedJwt.value;
  const value = buildApnsProviderJwt({
    keyId: env.APNS_KEY_ID,
    teamId: env.APNS_TEAM_ID,
    privateKeyPem: env.APNS_PRIVATE_KEY,
    nowSec,
  });
  cachedJwt = { value, mintedSec: nowSec };
  return value;
}

function apsBody(payload: ApnsPayload): string {
  // Custom keys live alongside `aps` per Apple's format, but must never clobber
  // the reserved `aps` dictionary itself — strip it defensively before spreading.
  const custom = { ...(payload.data ?? {}) };
  delete (custom as Record<string, unknown>).aps;
  return JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
    ...custom,
  });
}

// Bound how long we'll wait on Apple before giving up the whole batch — a hung
// gateway must not keep the (best-effort) result-entry path pending.
const APNS_BATCH_TIMEOUT_MS = 10_000;

// Send one notification over an already-open HTTP/2 session. Resolves with the
// status + Apple's reason (never rejects — a per-device failure is data, not an
// exception, so one bad token can't abort the whole batch).
function sendOne(
  session: http2.ClientHttp2Session,
  jwt: string,
  token: string,
  body: string,
): Promise<ApnsResult> {
  return new Promise((resolve) => {
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": env.APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"]) || 0;
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      let reason: string | undefined;
      if (data) {
        try {
          reason = (JSON.parse(data) as { reason?: string }).reason;
        } catch {
          /* empty / non-JSON body on success */
        }
      }
      resolve({ token, status, reason });
    });
    req.on("error", () => resolve({ token, status: 0, reason: "RequestError" }));
    req.end(body);
  });
}

// Send the same payload to many device tokens over a single HTTP/2 session.
// Returns one result per token (in input order). No-op (empty) when push is
// unconfigured or there are no tokens.
export async function sendApnsBatch(
  tokens: string[],
  payload: ApnsPayload,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<ApnsResult[]> {
  if (!pushEnabled || tokens.length === 0) return [];

  const host = env.APNS_PRODUCTION ? PROD_HOST : SANDBOX_HOST;
  const jwt = providerJwt(nowSec);
  const body = apsBody(payload);
  const session = http2.connect(host);
  session.setTimeout(APNS_BATCH_TIMEOUT_MS, () => session.destroy(new Error("APNs timeout")));

  try {
    return await new Promise<ApnsResult[]>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };
      // A session-level error (TLS/connect drop) fails the batch; after it has
      // settled, the late error is swallowed so it can't surface as an
      // unhandled rejection.
      session.on("error", (err) => finish(() => reject(err)));
      Promise.all(tokens.map((t) => sendOne(session, jwt, t, body))).then(
        (r) => finish(() => resolve(r)),
        (err) => finish(() => reject(err)),
      );
    });
  } finally {
    session.destroy();
  }
}
