"use client";

import { useActionState } from "react";
import { upgradePoolAction, type BillingState } from "./actions";

// Client wrapper so the upgrade CTA can surface inline errors (not-owner,
// billing-off, Stripe failure) without a full-page error. On success the action
// redirects to Stripe, so this never renders a success state itself.
export function UpgradeButton({ code, disabled }: { code: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    upgradePoolAction,
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="code" value={code} />
      <button
        type="submit"
        disabled={pending || disabled}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Redirecting…" : "Upgrade to Premium"}
      </button>
      {state.error ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
