// Stripe webhook plumbing, kept dependency-free (no Stripe SDK): signature
// verification with node:crypto and a pure event→intent mapper. Both are
// testable in isolation — the route handler in app/api/stripe/webhook just
// verifies, parses, interprets, and applies the intent to the DB.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { PoolTier } from "@/generated/prisma/enums";

// Default tolerance for the timestamp in the Stripe-Signature header (seconds).
// Mirrors Stripe's own SDK default; rejects replayed/old payloads.
const DEFAULT_TOLERANCE_SEC = 300;

// Verify a Stripe-Signature header against the raw request body. The header is
// `t=<unix>,v1=<hex>[,v1=<hex>...]`; the signed payload is `${t}.${body}` and the
// signature is HMAC-SHA256 keyed by the endpoint's webhook secret. Returns true
// only when a v1 signature matches and the timestamp is within tolerance.
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  opts: { toleranceSec?: number; nowSec?: number } = {},
): boolean {
  if (!header || !secret) return false;

  const parts = header.split(",").map((p) => p.trim());
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value ?? "";
    else if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSec ?? DEFAULT_TOLERANCE_SEC;
  if (Math.abs(nowSec - tsNum) > tolerance) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected);

  // Constant-time compare against each provided signature (Stripe may send more
  // than one during secret rotation).
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}

// The state change a webhook event implies for a pool. Null when the event is
// unrelated to billing or can't be tied back to a pool.
export interface StripeIntent {
  poolId: string;
  tier: PoolTier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

// Minimal shape of the events we handle (Stripe sends much more).
interface StripeEvent {
  type?: string;
  data?: { object?: Record<string, unknown> };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

// Narrow an unknown to a plain object (Stripe nests metadata one level deep);
// returns an empty object so callers can read keys without a cast that lies.
function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// Subscription statuses that grant premium access. Anything else (canceled,
// unpaid, past_due, incomplete_expired, paused) drops the pool back to FREE.
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Map a verified Stripe event to the pool tier change it implies. We handle the
// subscription lifecycle: a completed checkout grants premium; subscription
// updates/deletes track the subscription's status. The poolId rides on
// client_reference_id (checkout) and subscription metadata (we set both at
// checkout creation).
export function interpretStripeEvent(raw: unknown): StripeIntent | null {
  const event = raw as StripeEvent;
  const obj = event?.data?.object;
  if (!obj) return null;

  switch (event.type) {
    case "checkout.session.completed": {
      const poolId = str(obj.client_reference_id) ?? str(rec(obj.metadata).poolId);
      if (!poolId) return null;
      // Only subscription checkouts grant premium (require it affirmatively, so a
      // forged payload that omits `mode` can't slip through).
      if (obj.mode !== "subscription") return null;
      // Don't grant on a completed-but-unpaid checkout (e.g. async/delayed payment
      // methods, or a trial that left the session unpaid): only paid sessions —
      // or those needing no payment — upgrade. An absent payment_status is treated
      // as paid for back-compat (real subscription checkouts always set it).
      const paymentStatus = str(obj.payment_status);
      if (paymentStatus && paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
        return null;
      }
      return {
        poolId,
        tier: "PREMIUM",
        stripeCustomerId: str(obj.customer),
        stripeSubscriptionId: str(obj.subscription),
      };
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const poolId = str(rec(obj.metadata).poolId);
      if (!poolId) return null;
      const active =
        event.type === "customer.subscription.updated" &&
        ACTIVE_STATUSES.has(str(obj.status) ?? "");
      return {
        poolId,
        tier: active ? "PREMIUM" : "FREE",
        stripeCustomerId: str(obj.customer),
        stripeSubscriptionId: str(obj.id),
      };
    }
    default:
      return null;
  }
}
