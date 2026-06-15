// Apply a verified Stripe webhook intent to the DB: flip the pool's tier and
// record its Stripe ids. updateMany makes a missing pool a safe no-op, so a
// stray event never throws and Stripe won't retry forever.
//
// Assumes one active subscription per pool (the only product we sell). If a pool
// ever cycled subscriptions, an out-of-order delete of the old one could
// downgrade a pool with a newer active sub; we'd then guard the downgrade on the
// event's subscription id matching the stored one.

import { prisma } from "@/lib/db";
import type { StripeIntent } from "@/lib/billing/stripe-webhook";

export async function applyStripeIntent(intent: StripeIntent): Promise<void> {
  await prisma.pool.updateMany({
    where: { id: intent.poolId },
    data: {
      tier: intent.tier,
      ...(intent.stripeCustomerId ? { stripeCustomerId: intent.stripeCustomerId } : {}),
      ...(intent.stripeSubscriptionId
        ? { stripeSubscriptionId: intent.stripeSubscriptionId }
        : {}),
    },
  });
}
