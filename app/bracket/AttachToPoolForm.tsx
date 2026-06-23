"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attachEntryToPoolAction } from "./actions";

// Attach a standalone bracket to an existing pool by join code. On success,
// routes to the pool so the player sees their bracket on its leaderboard.
export function AttachToPoolForm({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await attachEntryToPoolAction({ entryId, joinCode: code });
      if (res.ok && res.joinCode) {
        router.push(`/pool/${res.joinCode}`);
      } else {
        setError(res.error ?? "Could not add to that pool.");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-pitch underline-offset-2 hover:underline"
      >
        Add to a pool →
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Join code"
          maxLength={16}
          className="h-9 w-32 rounded-lg border border-line bg-surface px-2.5 text-sm font-mono uppercase tracking-wide text-ink outline-none focus:border-pitch"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !code.trim()}
          className="inline-flex h-9 items-center justify-center rounded-full bg-pitch px-4 text-xs font-semibold text-white hover:bg-pitch-dark disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs font-semibold text-ink-3 hover:text-ink-2"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-xs font-semibold text-negative">{error}</p> : null}
    </div>
  );
}
