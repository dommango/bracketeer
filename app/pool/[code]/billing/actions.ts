"use server";

import { redirect } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess } from "@/lib/pool/access";
import { stripeEnabled } from "@/lib/env";
import { startPoolCheckout } from "@/lib/billing/checkout";
import { rateLimit } from "@/lib/rate-limit";

export interface BillingState {
  error?: string;
}

// useActionState-compatible: owner starts a premium upgrade and is redirected to
// Stripe Checkout, or gets inline feedback (not owner / billing off / Stripe error).
export async function upgradePoolAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const code = String(formData.get("code") || "");
  const pool = await getPoolByCode(code);
  if (!pool) return { error: "Pool not found." };

  const access = await getPoolAccess(pool.id);
  if (!access?.isOwner) return { error: "Only the pool owner can upgrade." };
  if (!stripeEnabled) return { error: "Billing isn't configured yet — check back soon." };

  if (!(await rateLimit(`upgrade:${access.user.id}`, 10, 60_000)).ok) {
    return { error: "Too many attempts — try again shortly." };
  }

  let url: string;
  try {
    url = await startPoolCheckout(pool.id, pool.joinCode);
  } catch (err) {
    return { error: (err as Error).message };
  }
  // External redirect to Stripe's hosted checkout.
  redirect(url);
}
