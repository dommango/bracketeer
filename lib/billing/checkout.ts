// Bridge between the billing UI and Stripe: resolve the pool, build success/
// cancel URLs, and create a Checkout Session. Callers must already have verified
// owner access and that billing is enabled (stripeEnabled).

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { createCheckoutSession } from "@/lib/billing/stripe";

// Start a premium upgrade for a pool, returning the Stripe-hosted checkout URL to
// redirect the owner to. Reuses an existing Stripe customer when present.
export async function startPoolCheckout(poolId: string, code: string): Promise<string> {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: {
      tier: true,
      stripeCustomerId: true,
      owner: { select: { email: true } },
    },
  });
  if (!pool) throw new Error("Pool not found.");
  if (pool.tier === "PREMIUM") throw new Error("This pool is already Premium.");

  const base = env.APP_BASE_URL.replace(/\/+$/, "");
  const session = await createCheckoutSession({
    poolId,
    successUrl: `${base}/pool/${code}/billing?upgraded=1`,
    cancelUrl: `${base}/pool/${code}/billing`,
    customerEmail: pool.owner.email,
    customerId: pool.stripeCustomerId,
  });
  return session.url;
}
