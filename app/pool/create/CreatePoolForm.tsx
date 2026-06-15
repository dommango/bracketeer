"use client";

import { useActionState, useState } from "react";
import { createPoolAction, type CreatePoolState } from "./actions";
import type { PoolFormat } from "@/lib/pool/manage";

const INPUT =
  "h-11 w-full rounded-md border border-line bg-surface px-[18px] text-[15px] text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]";
const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// The two game types, in display order. KNOCKOUT is the featured standalone
// challenge; FULL_BRACKET is the classic whole-tournament pool.
const GAME_TYPES: { value: PoolFormat; title: string; blurb: string }[] = [
  {
    value: "KNOCKOUT",
    title: "Knockout Challenge",
    blurb: "Predict the bracket once the last 32 are set. Picks lock at the Round-of-32 kickoff.",
  },
  {
    value: "FULL_BRACKET",
    title: "Full Bracket",
    blurb: "The classic pool — group stage through the final. Import or fill out the whole bracket.",
  },
];

export function CreatePoolForm({
  defaultDisplayName,
  defaultFormat = "FULL_BRACKET",
}: {
  defaultDisplayName: string;
  defaultFormat?: PoolFormat;
}) {
  const [state, action, pending] = useActionState<CreatePoolState, FormData>(
    createPoolAction,
    {},
  );
  const [format, setFormat] = useState<PoolFormat>(defaultFormat);

  return (
    <form action={action} className="mt-5 space-y-4">
      <fieldset className="space-y-1.5">
        <legend className={LABEL}>Game type</legend>
        <div className="mt-1.5 space-y-2">
          {GAME_TYPES.map((g) => {
            const selected = format === g.value;
            return (
              <label
                key={g.value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                  selected
                    ? "border-pitch bg-pitch/5 shadow-[0_0_0_3px_rgba(11,107,58,0.12)]"
                    : "border-line bg-surface hover:bg-surface-sunk"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={g.value}
                  checked={selected}
                  onChange={() => setFormat(g.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-pitch"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{g.title}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-3">{g.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

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
