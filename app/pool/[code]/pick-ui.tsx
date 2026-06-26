"use client";

// Shared presentational pieces for the bracket builders (full-bracket PickForm and
// the knockout-only KnockoutPickForm): the progress bar, the section label style,
// and the single-tap winner-selection matchup card.

import { resolveKnockout, type KnockoutSlot } from "@/lib/pool/pick-form";
import type { Picks } from "@/lib/scoring/types";
import { ROUND_ACCENT, roundCodeForMatch } from "@/lib/pool/bracket-tree";
import { Flag } from "./Flag";

export const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// The four scored awards + the four knockout cascade stages (Final is rendered
// separately), shared by both bracket builders so their copy can't drift.
export const AWARDS: { key: keyof Picks["awards"]; label: string }[] = [
  { key: "player", label: "Player of the tournament" },
  { key: "young", label: "Best young player" },
  { key: "boot", label: "Golden Boot (top scorer)" },
  { key: "goal", label: "Best goal" },
];

export const KO_STAGES: { key: keyof ReturnType<typeof resolveKnockout>; label: string }[] = [
  { key: "r32", label: "Round of 32" },
  { key: "r16", label: "Round of 16" },
  { key: "qf", label: "Quarter-finals" },
  { key: "sf", label: "Semi-finals" },
];

export function Bar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunk">
      <div
        className="h-full rounded-full bg-pitch transition-[width] duration-[var(--dur-2)] [transition-timing-function:var(--ease-standard)] motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Single-tap winner selection styled like the design system's PickSelector:
// two big centered options (real flag, display-font code, name), a "vs"
// divider, and a solid pitch-green picked state.
export function KnockoutMatch({
  slot,
  disabled,
  onPick,
}: {
  slot: KnockoutSlot;
  disabled: boolean;
  onPick: (matchNo: number, code: string) => void;
}) {
  const ready = Boolean(slot.a && slot.b);

  const option = (side: KnockoutSlot["a"]) => {
    const picked = side && slot.pick === side.code;
    return (
      <button
        type="button"
        disabled={disabled || !ready || !side}
        onClick={() => side && onPick(slot.matchNo, side.code)}
        aria-pressed={Boolean(picked)}
        className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-3 transition-all duration-[var(--dur-2)] [transition-timing-function:var(--ease-standard)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pitch disabled:cursor-not-allowed motion-reduce:transition-none ${
          picked
            ? "border-pitch bg-pitch text-white"
            : "border-line bg-surface text-ink hover:bg-pitch-tint disabled:opacity-50 disabled:hover:bg-surface"
        }`}
      >
        {side ? (
          <>
            <Flag code={side.code} size={48} />
            <span className="font-display text-lg leading-none tracking-[0.02em]">{side.code}</span>
            <span
              className={`w-full truncate text-xs font-medium ${
                picked ? "text-white/85" : "text-ink-3"
              }`}
            >
              {side.name}
            </span>
          </>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </button>
    );
  };

  const accent = ROUND_ACCENT[roundCodeForMatch(slot.matchNo)] ?? "var(--line)";

  return (
    <div
      className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
        <span className="font-mono">M{slot.matchNo}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2.5">
        {option(slot.a)}
        <span className="self-center font-display text-xs text-ink-3" aria-hidden>
          vs
        </span>
        {option(slot.b)}
      </div>
    </div>
  );
}
