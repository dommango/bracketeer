"use client";

// The knockout cascade for both bracket builders (full-bracket PickForm and the
// knockout-only KnockoutPickForm). One component renders two layouts off the same
// resolved model so they can't drift:
//   • mobile / tablet  → the stacked per-stage grids (lg:hidden)
//   • desktop (lg+)     → a true left-to-right bracket tree, winners flowing right
// The tree reuses the read-only bracket's column geometry (lib/pool/bracket-tree)
// and `.bkt-round`/`.bkt-cell` elbow connectors (app/globals.css), with the
// single-tap KnockoutMatch card in every cell.

import type { KnockoutModel, KnockoutSlot } from "@/lib/pool/pick-form";
import { ROUND_ACCENT, sortByTree } from "@/lib/pool/bracket-tree";
import { roundLabel } from "@/lib/pool/rounds";
import { KnockoutMatch, KO_STAGES } from "./pick-ui";

type OnPick = (matchNo: number, code: string) => void;

const TREE_COLUMNS: { code: string; key: keyof KnockoutModel }[] = [
  { code: "R32", key: "r32" },
  { code: "R16", key: "r16" },
  { code: "QF", key: "qf" },
  { code: "SF", key: "sf" },
  { code: "FINAL", key: "final" },
];

function RoundHeading({ code }: { code: string }) {
  return (
    <h4 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.08em] text-ink-2">
      <span className="h-2.5 w-2.5 rounded" style={{ background: ROUND_ACCENT[code] ?? "var(--line)" }} />
      {roundLabel(code)}
    </h4>
  );
}

// Desktop: the interactive bracket tree. Mirrors Bracket.tsx's BracketTree layout
// (round headings row + columns of cells) but each cell is a tappable KnockoutMatch.
function BracketTreeBuilder({
  ko,
  disabled,
  onPick,
}: {
  ko: KnockoutModel;
  disabled: boolean;
  onPick: OnPick;
}) {
  const slotsFor = (key: keyof KnockoutModel): KnockoutSlot[] =>
    key === "final" ? [ko.final] : (ko[key] as KnockoutSlot[]);

  return (
    <div className="relative left-1/2 w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[1120px]">
          {TREE_COLUMNS.map((c) => (
            <div key={c.code} className="min-w-[224px] flex-1 px-5">
              <RoundHeading code={c.code} />
            </div>
          ))}
        </div>

        <div className="mt-2 flex min-w-[1120px]">
          {TREE_COLUMNS.map((c) => (
            <div key={c.code} className="bkt-round flex min-w-[224px] flex-1 flex-col">
              {sortByTree(slotsFor(c.key)).map((slot) => (
                <div key={slot.matchNo} className="bkt-cell flex items-center px-5">
                  <div className="w-full">
                    <KnockoutMatch slot={slot} disabled={disabled} onPick={onPick} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KnockoutCascade({
  ko,
  disabled,
  onPick,
}: {
  ko: KnockoutModel;
  disabled: boolean;
  onPick: OnPick;
}) {
  return (
    <>
      {/* Mobile / tablet: stacked per-stage grids. */}
      <div className="space-y-4 lg:hidden">
        {KO_STAGES.map((stage) => {
          const slots = ko[stage.key] as KnockoutSlot[];
          return (
            <div key={stage.key}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                {stage.label}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {slots.map((slot) => (
                  <KnockoutMatch key={slot.matchNo} slot={slot} disabled={disabled} onPick={onPick} />
                ))}
              </div>
            </div>
          );
        })}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-gold-dark">
            Final
          </p>
          <div className="sm:max-w-[50%]">
            <KnockoutMatch slot={ko.final} disabled={disabled} onPick={onPick} />
          </div>
        </div>
      </div>

      {/* Desktop: the interactive bracket tree. */}
      <div className="hidden lg:block">
        <BracketTreeBuilder ko={ko} disabled={disabled} onPick={onPick} />
      </div>
    </>
  );
}
