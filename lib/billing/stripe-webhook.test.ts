import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyStripeSignature, interpretStripeEvent } from "./stripe-webhook";

const SECRET = "whsec_test_secret";

function sign(payload: string, secret: string, ts: number): string {
  const sig = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const nowSec = 1_700_000_000;

  it("accepts a correctly signed, in-tolerance payload", () => {
    const header = sign(payload, SECRET, nowSec);
    expect(verifyStripeSignature(payload, header, SECRET, { nowSec })).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const header = sign(payload, SECRET, nowSec);
    expect(verifyStripeSignature(payload + "x", header, SECRET, { nowSec })).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const header = sign(payload, SECRET, nowSec);
    expect(verifyStripeSignature(payload, header, "whsec_other", { nowSec })).toBe(false);
  });

  it("rejects a timestamp outside tolerance", () => {
    const header = sign(payload, SECRET, nowSec - 10_000);
    expect(verifyStripeSignature(payload, header, SECRET, { nowSec })).toBe(false);
  });

  it("accepts when one of several v1 signatures matches (key rotation)", () => {
    const good = createHmac("sha256", SECRET).update(`${nowSec}.${payload}`).digest("hex");
    const header = `t=${nowSec},v1=deadbeef,v1=${good}`;
    expect(verifyStripeSignature(payload, header, SECRET, { nowSec })).toBe(true);
  });

  it("rejects a missing/empty header or secret", () => {
    expect(verifyStripeSignature(payload, null, SECRET, { nowSec })).toBe(false);
    expect(verifyStripeSignature(payload, sign(payload, SECRET, nowSec), "", { nowSec })).toBe(false);
  });
});

describe("interpretStripeEvent", () => {
  it("grants premium on a completed subscription checkout", () => {
    const intent = interpretStripeEvent({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "pool_abc",
          customer: "cus_1",
          subscription: "sub_1",
        },
      },
    });
    expect(intent).toEqual({
      poolId: "pool_abc",
      tier: "PREMIUM",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("falls back to metadata.poolId when client_reference_id is absent", () => {
    const intent = interpretStripeEvent({
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", metadata: { poolId: "pool_xyz" } } },
    });
    expect(intent?.poolId).toBe("pool_xyz");
    expect(intent?.tier).toBe("PREMIUM");
  });

  it("keeps premium while a subscription stays active", () => {
    const intent = interpretStripeEvent({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", status: "active", customer: "cus_1", metadata: { poolId: "p1" } } },
    });
    expect(intent).toEqual({
      poolId: "p1",
      tier: "PREMIUM",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("downgrades to FREE when a subscription is canceled or deleted", () => {
    expect(
      interpretStripeEvent({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_1", status: "canceled", metadata: { poolId: "p1" } } },
      })?.tier,
    ).toBe("FREE");

    expect(
      interpretStripeEvent({
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_1", status: "canceled", metadata: { poolId: "p1" } } },
      })?.tier,
    ).toBe("FREE");
  });

  it("ignores events with no pool linkage or unhandled types", () => {
    expect(
      interpretStripeEvent({
        type: "checkout.session.completed",
        data: { object: { mode: "subscription" } },
      }),
    ).toBeNull();
    expect(
      interpretStripeEvent({ type: "invoice.paid", data: { object: { metadata: { poolId: "p1" } } } }),
    ).toBeNull();
    expect(interpretStripeEvent(null)).toBeNull();
  });

  it("ignores non-subscription checkout modes", () => {
    expect(
      interpretStripeEvent({
        type: "checkout.session.completed",
        data: { object: { mode: "payment", client_reference_id: "p1" } },
      }),
    ).toBeNull();
  });

  it("does not grant premium when mode is absent (must be subscription affirmatively)", () => {
    expect(
      interpretStripeEvent({
        type: "checkout.session.completed",
        data: { object: { client_reference_id: "p1" } },
      }),
    ).toBeNull();
  });

  it("does not grant premium on a completed-but-unpaid checkout", () => {
    expect(
      interpretStripeEvent({
        type: "checkout.session.completed",
        data: {
          object: { mode: "subscription", client_reference_id: "p1", payment_status: "unpaid" },
        },
      }),
    ).toBeNull();
  });

  it("grants premium when payment_status is paid or no_payment_required", () => {
    for (const payment_status of ["paid", "no_payment_required"]) {
      expect(
        interpretStripeEvent({
          type: "checkout.session.completed",
          data: { object: { mode: "subscription", client_reference_id: "p1", payment_status } },
        })?.tier,
      ).toBe("PREMIUM");
    }
  });
});
