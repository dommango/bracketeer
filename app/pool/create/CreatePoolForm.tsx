"use client";

import { useActionState, useState } from "react";
import { createPoolAction, type CreatePoolState } from "./actions";
import type { PoolFormat } from "@/lib/pool/manage";

const INPUT =
  "h-11 w-full rounded-md border border-line bg-surface px-[18px] text-[15px] text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]";
const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// A single game card, fully resolved on the server (copy + current state + whether
// it's creatable right now) so the client just renders — no time math, no risk of
// the card disagreeing with the page's availability gating.
export interface GameCardVM {
  value: PoolFormat;
  title: string;
  blurb: string;
  // Short state line, e.g. "Open now · first pick locks 24 Jun".
  stateLine: string;
  // True when this format can't be created right now (shown disabled).
  disabled: boolean;
}

export function CreatePoolForm({
  defaultDisplayName,
  defaultFormat,
  cards,
}: {
  defaultDisplayName: string;
  defaultFormat: PoolFormat;
  // Ordered, server-resolved game cards (featured first).
  cards: GameCardVM[];
}) {
  const [state, action, pending] = useActionState<CreatePoolState, FormData>(
    createPoolAction,
    {},
  );
  const firstCreatable = cards.find((c) => !c.disabled)?.value ?? defaultFormat;
  const initial = cards.find((c) => c.value === defaultFormat && !c.disabled)
    ? defaultFormat
    : firstCreatable;
  const [format, setFormat] = useState<PoolFormat>(initial);

  return (
    <form action={action} className="mt-5 space-y-4">
      <fieldset className="space-y-1.5">
        <legend className={LABEL}>Pool type</legend>
        <div className="mt-1.5 space-y-2">
          {cards.map((c) => {
            const selected = format === c.value && !c.disabled;
            return (
              <label
                key={c.value}
                className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                  c.disabled
                    ? "cursor-not-allowed border-line bg-surface-sunk opacity-60"
                    : selected
                      ? "cursor-pointer border-pitch bg-pitch/5 shadow-[0_0_0_3px_rgba(11,107,58,0.12)]"
                      : "cursor-pointer border-line bg-surface hover:bg-surface-sunk"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={c.value}
                  checked={selected}
                  disabled={c.disabled}
                  onChange={() => setFormat(c.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-pitch"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{c.title}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-3">{c.blurb}</span>
                  <span
                    className={`mt-1.5 block text-[12px] font-semibold ${
                      c.disabled ? "text-ink-3" : "text-pitch-dark"
                    }`}
                  >
                    {c.stateLine}
                  </span>
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
