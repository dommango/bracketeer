"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "./actions";

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
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
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
