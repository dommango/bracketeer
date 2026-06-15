// POST /api/stripe/webhook — Stripe subscription lifecycle events. Verifies the
// signature against STRIPE_WEBHOOK_SECRET (constant-time, in stripe-webhook.ts),
// maps the event to a pool tier change, and applies it. Idempotent: replays just
// re-set the same tier. A safe 503 when billing isn't configured.

import { NextRequest } from "next/server";
import { env, stripeEnabled } from "@/lib/env";
import { verifyStripeSignature, interpretStripeEvent } from "@/lib/billing/stripe-webhook";
import { applyStripeIntent } from "@/lib/billing/apply";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!stripeEnabled) return apiError("billing not configured", 503);

  // Stripe signs the raw body — read text(), never the parsed JSON.
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)) {
    return apiError("invalid signature", 400);
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return apiError("invalid payload", 400);
  }

  const intent = interpretStripeEvent(event);
  if (!intent) return apiOk({ ignored: true });

  try {
    await applyStripeIntent(intent);
    return apiOk({ applied: true });
  } catch (err) {
    console.error("stripe webhook apply failed:", err);
    return apiError("apply failed", 500);
  }
}
