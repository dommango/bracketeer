"use client";

import { useActionState } from "react";
import { joinPoolAction, type JoinPoolState } from "./actions";
import { PRIMARY_BUTTON } from "@/lib/ui/buttons";
import { LABEL } from "@/lib/ui/labels";

export function JoinPoolForm({
  defaultCode = "",
  defaultDisplayName = "",
}: {
  defaultCode?: string;
  defaultDisplayName?: string;
}) {
  const [state, action, pending] = useActionState<JoinPoolState, FormData>(
    joinPoolAction,
    {},
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="code" className={LABEL}>
          Join code
        </label>
        <div className="flex h-11 items-center gap-2 rounded-md border border-line bg-surface px-[18px] focus-within:border-pitch focus-within:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]">
          <span className="font-mono font-bold text-ink-3">#</span>
          <input
            id="code"
            name="code"
            required
            maxLength={6}
            defaultValue={defaultCode}
            placeholder="ABC123"
            autoCapitalize="characters"
            className="min-w-0 flex-1 bg-transparent text-[15px] uppercase tracking-wide text-ink outline-none placeholder:normal-case"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="displayName" className={LABEL}>
          Your display name
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={defaultDisplayName}
          maxLength={40}
          placeholder="How you'll appear on the board"
          className="h-11 w-full rounded-md border border-line bg-surface px-[18px] text-[15px] text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]"
        />
      </div>

      {state.error ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`${PRIMARY_BUTTON} disabled:opacity-60`}
      >
        {pending ? "Joining…" : "Join pool"}
      </button>
    </form>
  );
}
