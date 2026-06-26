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

// Single-tap winner selection that mirrors the read-only matches-tab bracket card
// (Bracket.tsx's MatchCard/Side): the same card chrome — accent left border, the
// M-tag header, two stacked team rows (flag, name, code) split by a hairline — but
// each row is a button. Tapping a row picks that team as the winner; the picked
// row reads bold (like a decided match's winner) and the other dims.
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
  const hasPick = Boolean(slot.pick);

  const row = (side: KnockoutSlot["a"]) => {
    const picked = Boolean(side && slot.pick === side.code);
    const dimmed = hasPick && !picked;
    return (
      <button
        type="button"
        disabled={disabled || !ready || !side}
        onClick={() => side && onPick(slot.matchNo, side.code)}
        aria-pressed={picked}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-[var(--dur-2)] [transition-timing-function:var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pitch disabled:cursor-not-allowed motion-reduce:transition-none ${
          picked ? "bg-pitch-tint" : "enabled:hover:bg-surface-sunk"
        }`}
      >
        <Flag code={side?.code ?? null} size={24} />
        <span
          className={`flex-1 truncate ${
            picked
              ? "font-bold text-pitch-dark"
              : dimmed
                ? "font-medium text-ink-4"
                : "font-medium text-ink"
          }`}
        >
          {side ? side.name : "—"}
          {side ? (
            <span
              className={`ml-1.5 font-mono text-[10px] ${
                picked ? "text-pitch-dark/70" : "text-ink-3"
              }`}
            >
              {side.code}
            </span>
          ) : null}
        </span>
        {picked ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-pitch-dark">
            Pick
          </span>
        ) : null}
      </button>
    );
  };

  const accent = ROUND_ACCENT[roundCodeForMatch(slot.matchNo)] ?? "var(--line)";

  return (
    <div
      className="rounded-2xl border border-line bg-surface p-4 text-sm shadow-[var(--shadow-xs)]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">
            M{slot.matchNo}
          </span>
        </span>
        {ready && !hasPick && !disabled ? (
          <span className="font-mono text-[10px] text-ink-3">Tap to pick</span>
        ) : null}
      </div>
      {row(slot.a)}
      <div className="my-0.5 h-px bg-line-soft" />
      {row(slot.b)}
    </div>
  );
}
