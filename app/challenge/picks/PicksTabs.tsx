"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { PicksSectionKey } from "@/lib/challenge/picks-summary";

export interface PicksSection {
  key: PicksSectionKey;
  title: string;
  // Live progress line (md3CountLine, or "3/16 picks").
  progress: string;
  // The game-state copy from gameStateLine.
  stateLine: string;
  // The heavy form element (or a gate notice). Only the active section's body is
  // rendered, so one form hydrates at a time and it gets the full column width.
  body: ReactNode;
}

// Segmented switch between the two challenges' picks: the selected game's form is
// shown full column width with no surrounding box (the bracket builder needs the
// room), mirroring the GameSwitcher pill used on the board pages.
export function PicksTabs({
  sections,
  initial,
}: {
  sections: PicksSection[];
  initial: PicksSectionKey;
}) {
  const [active, setActive] = useState<PicksSectionKey>(initial);
  const current = sections.find((s) => s.key === active) ?? sections[0];

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {sections.map((s) => {
          const isActive = s.key === current.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              id={`picks-tab-${s.key}`}
              aria-selected={isActive}
              aria-controls="picks-tabpanel"
              onClick={() => setActive(s.key)}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-3 py-2 text-center text-[13px] font-semibold transition-colors ${
                isActive
                  ? "bg-pitch-tint text-pitch-dark shadow-[inset_0_0_0_1px_var(--color-gold)]"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              {s.title}
            </button>
          );
        })}
      </div>
      <p className="px-1 text-[13px] text-ink-3">
        {current.progress} · {current.stateLine}
      </p>
      <div
        id="picks-tabpanel"
        role="tabpanel"
        aria-labelledby={`picks-tab-${current.key}`}
      >
        {current.body}
      </div>
    </div>
  );
}
