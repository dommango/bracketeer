// Minimal Stripe client over fetch — just the one call we need (create a
// subscription Checkout Session). Avoids pulling in the Stripe SDK; webhook
// verification lives in stripe-webhook.ts. All callers must guard on
// stripeEnabled (lib/env) first — this throws if the secret key is unset.

import { env } from "@/lib/env";
import { encodeStripeForm } from "./stripe-encode";

const STRIPE_API = "https://api.stripe.com/v1";

export interface CheckoutSessionInput {
  poolId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  // Reuse an existing Stripe customer when the pool was billed before.
  customerId?: string | null;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

// Create a subscription Checkout Session for a pool's premium upgrade. The
// poolId rides on client_reference_id and on the subscription metadata, so both
// the checkout.session.completed and later customer.subscription.* events can be
// tied back to the pool (see interpretStripeEvent).
export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSession> {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");

  const params: Record<string, unknown> = {
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.poolId,
    line_items: [{ price: env.STRIPE_PRICE_PREMIUM, quantity: 1 }],
    subscription_data: { metadata: { poolId: input.poolId } },
    metadata: { poolId: input.poolId },
  };
  // A returning pool reuses its customer; otherwise prefill the email.
  if (input.customerId) params.customer = input.customerId;
  else if (input.customerEmail) params.customer_email = input.customerEmail;

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeStripeForm(params),
  });

  const body = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !body.url || !body.id) {
    throw new Error(body.error?.message ?? `Stripe checkout failed (${res.status}).`);
  }
  return { id: body.id, url: body.url };
}
