"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleChallengeAction } from "./actions";

// Opt a solo bracket into / out of the public Bracketeer Knockout Challenge.
// Optimistic label; reverts and surfaces the error if the server rejects.
export function ChallengeToggle({
  entryId,
  entered,
  needsConsent = false,
}: {
  entryId: string;
  entered: boolean;
  // True when the signed-in user hasn't accepted the terms yet — require the
  // consent checkbox before they can enter (the challenge carries a prize).
  needsConsent?: boolean;
}) {
  const [on, setOn] = useState(entered);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    // Turning ON without prior consent requires the checkbox first.
    if (next && needsConsent && !agreed) {
      setError("Tick the box to confirm you're 18+ and accept the terms.");
      return;
    }
    setError(null);
    setOn(next);
    startTransition(async () => {
      const res = await toggleChallengeAction(entryId, next, agreed);
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
          <p className="text-sm font-semibold text-ink">Knockout Challenge</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {on
              ? "Your bracket is on the global leaderboard."
              : "Enter to compete against every other bracket."}
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
      {needsConsent && !on ? (
        <label className="mt-3 flex items-start gap-2 text-[12px] text-ink-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            I&apos;m 18+ and agree to the{" "}
            <Link href="/terms" className="font-semibold text-pitch hover:underline">Terms</Link>,{" "}
            <Link href="/privacy" className="font-semibold text-pitch hover:underline">Privacy Policy</Link>{" "}
            and{" "}
            <Link href="/rules" className="font-semibold text-pitch hover:underline">Official Rules</Link>.
          </span>
        </label>
      ) : null}
      {error ? <p className="mt-2 text-xs font-semibold text-negative">{error}</p> : null}
    </div>
  );
}
