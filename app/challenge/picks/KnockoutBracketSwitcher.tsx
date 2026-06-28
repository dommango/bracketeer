"use client";

import { useState } from "react";
import type { AdvanceMap } from "@/lib/pool/knockout-advance";
import type { ResolvedR32 } from "@/lib/scoring/resolve";
import type { StadiumProjection } from "@/lib/pool/stadium-projection";
import type { OutrightProb } from "@/lib/odds/map";
import type { KnockoutCardInfo } from "@/lib/pool/queries-odds";
import type { Picks } from "@/lib/scoring/types";
import { KnockoutPickForm, type SaveBracket } from "@/app/pool/[code]/KnockoutPickForm";

export interface SwitcherBracket {
  entryId: string;
  // Where the bracket lives, e.g. "Solo" or a pool name — the toggle label.
  title: string;
  initialPicks: Picks;
  initialAdvance: AdvanceMap;
  initialTiebreak: string;
  label: string;
  // Final lock state for this bracket (global R32 lock or per-entry admin lock).
  locked: boolean;
  // Saved-pick progress for the toggle badge; null when nothing's picked yet.
  progress: { done: number; total: number } | null;
}

// Toggle between the knockout brackets a user has entered in the Challenge (solo
// + pooled) and edit each in place — no trip back to /bracket. At most
// CHALLENGE_ENTRY_CAP brackets, so the list is tiny. Switching remounts the
// builder (keyed by entryId) so its internal state resets to the selected
// bracket's saved picks; the seed/odds props are identical across brackets (the
// field is the same for everyone), so they're shared.
export function KnockoutBracketSwitcher({
  brackets,
  seed,
  provisional,
  early,
  projections,
  outrights,
  info,
  titleOdds,
  saveAction,
}: {
  brackets: SwitcherBracket[];
  seed: ResolvedR32;
  provisional: boolean;
  early: boolean;
  projections?: Record<number, StadiumProjection>;
  outrights?: OutrightProb[];
  info?: Record<number, KnockoutCardInfo>;
  titleOdds?: Record<string, number>;
  saveAction: SaveBracket;
}) {
  const [selectedId, setSelectedId] = useState(brackets[0]?.entryId);
  const selected = brackets.find((b) => b.entryId === selectedId) ?? brackets[0];

  return (
    <div className="space-y-3">
      <div>
        <p className="px-1 pb-1.5 text-[11px] font-semibold text-ink-3">
          Editing — switch between your entered brackets
        </p>
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {brackets.map((b) => {
            const isActive = b.entryId === selected.entryId;
            return (
              <button
                key={b.entryId}
                type="button"
                onClick={() => setSelectedId(b.entryId)}
                aria-current={isActive ? "true" : undefined}
                className={`flex-1 rounded-full px-3 py-1.5 text-center text-[13px] font-semibold transition-colors ${
                  isActive
                    ? "bg-pitch-tint text-pitch-dark shadow-[inset_0_0_0_1px_var(--color-gold)]"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                <span className="truncate">{b.title}</span>
                {b.progress ? (
                  <span className="ml-1.5 font-mono text-[11px] tabular-nums text-ink-3">
                    {b.progress.done}/{b.progress.total}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <KnockoutPickForm
        key={selected.entryId}
        entryId={selected.entryId}
        initialPicks={selected.initialPicks}
        initialAdvance={selected.initialAdvance}
        initialTiebreak={selected.initialTiebreak}
        label={selected.label}
        locked={selected.locked}
        seed={seed}
        provisional={provisional}
        early={early}
        projections={projections}
        outrights={outrights}
        info={info}
        titleOdds={titleOdds}
        saveAction={saveAction}
      />
    </div>
  );
}
