"use client";

import { useActionState } from "react";
import { createPoolAction, type CreatePoolState } from "./actions";

const INPUT =
  "h-11 w-full rounded-md border border-line bg-surface px-[18px] text-[15px] text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]";
const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

export function CreatePoolForm({ defaultDisplayName }: { defaultDisplayName: string }) {
  const [state, action, pending] = useActionState<CreatePoolState, FormData>(
    createPoolAction,
    {},
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className={LABEL}>
          Pool name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={60}
          placeholder="Friends & Family Pool"
          className={INPUT}
        />
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
          className={INPUT}
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
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create pool"}
      </button>
    </form>
  );
}
