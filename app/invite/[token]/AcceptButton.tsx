"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "./actions";
import { PRIMARY_BUTTON } from "@/lib/ui/buttons";

// Accept via a POST action (not a link) so route prefetching can never auto-join.
export function AcceptButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInviteAction,
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className={`${PRIMARY_BUTTON} disabled:opacity-60`}
      >
        {pending ? "Joining…" : "Accept invite & join"}
      </button>
      {state.error ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
