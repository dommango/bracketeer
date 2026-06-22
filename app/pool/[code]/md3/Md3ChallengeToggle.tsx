"use client";

import { useState, useTransition } from "react";
import { toggleMd3ChallengeAction } from "./actions";

// Opt-in control for the public Match Day 3 Pickem challenge. Shown once the user
// has saved an entry. Eligibility for the prize needs a *complete* bracket (all
// 24 fixtures predicted) — surfaced inline so people know to finish before the
// fixtures lock.
export function Md3ChallengeToggle({
  code,
  entered,
  complete,
}: {
  code: string;
  entered: boolean;
  complete: boolean;
}) {
  const [isEntered, setIsEntered] = useState(entered);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    setError(null);
    const next = !isEntered;
    startTransition(async () => {
      const res = await toggleMd3ChallengeAction(code, next);
      if (res.ok) {
        setIsEntered(next);
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-pitch/30 bg-pitch/5 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pitch-dark">
        Public challenge
      </p>
      <p className="mt-1.5 text-sm text-ink-2">
        Enter your picks into the global Match Day 3 Pickem challenge to compete for the prize.
      </p>

      <label className="mt-3 flex items-center gap-3">
        <input
          type="checkbox"
          checked={isEntered}
          disabled={pending}
          onChange={toggle}
          className="h-4 w-4 shrink-0 accent-pitch"
        />
        <span className="text-sm font-semibold text-ink">
          {isEntered ? "Entered in the challenge" : "Enter the challenge"}
        </span>
      </label>

      {isEntered && !complete ? (
        <p className="mt-2 rounded-lg bg-surface-sunk px-3 py-2 text-[13px] text-ink-2">
          Incomplete bracket — predict all 24 fixtures to be eligible for the prize.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-[13px] text-negative">
          {error}
        </p>
      ) : null}
    </section>
  );
}
