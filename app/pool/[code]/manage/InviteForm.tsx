"use client";

import { useActionState } from "react";
import { createInviteAction, type InviteState } from "./actions";
import { CopyButton } from "./CopyButton";

const INPUT =
  "h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-pitch";

// Mint a shareable (optionally pre-addressed) invite link. On success the link is
// shown for copying; when an email was given the action also sends it.
export function InviteForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    createInviteAction,
    {},
  );

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-3">
        Send a personal invite link — add an email to deliver it (when email is configured), or
        just create a link to share.
      </p>
      <form action={action} className="flex gap-2">
        <input type="hidden" name="code" value={code} />
        <input
          name="email"
          type="email"
          placeholder="friend@example.com (optional)"
          aria-label="Invite email"
          className={INPUT}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-pitch px-5 text-sm font-semibold text-white hover:bg-pitch-dark disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create invite"}
        </button>
      </form>

      {state.url ? (
        <div className="rounded-2xl border border-pitch/30 bg-pitch-tint p-3">
          <p className="text-xs font-semibold text-pitch-dark">
            {state.email ? `Invite emailed to ${state.email}.` : "Invite link ready."} Share this
            link:
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={state.url}
              aria-label="Invite link"
              className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-ink-2 outline-none"
            />
            <CopyButton value={state.url} label="Copy" />
          </div>
        </div>
      ) : null}

      {state.error ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
