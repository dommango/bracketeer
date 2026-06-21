"use client";

import { useState, useTransition } from "react";
import { toggleMasterAction } from "./actions";

// Opt a solo bracket into / out of the public master tournament. Optimistic
// label; reverts and surfaces the error if the server rejects.
export function MasterToggle({ entered }: { entered: boolean }) {
  const [on, setOn] = useState(entered);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    setError(null);
    setOn(next);
    startTransition(async () => {
      const res = await toggleMasterAction(next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error ?? "Could not update.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Master knockout tournament</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {on
              ? "Your bracket is on the global leaderboard."
              : "Enter to compete against every other solo bracket."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-pitch" : "bg-ink-4/40"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-negative">{error}</p> : null}
    </div>
  );
}
