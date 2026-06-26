"use client";

import { useMemo, useState, useTransition } from "react";
import { resolveKnockout, knockoutOnlyProgress } from "@/lib/pool/pick-form";
import {
  resolveAdvance,
  deriveAdvance,
  quickFillFavorites,
  type AdvanceMap,
} from "@/lib/pool/knockout-advance";
import type { ResolvedR32 } from "@/lib/scoring/resolve";
import type { StadiumProjection } from "@/lib/pool/stadium-projection";
import type { OutrightProb } from "@/lib/odds/map";
import { emptyPicks, type Picks } from "@/lib/scoring/types";
import { submitPicksAction } from "./picks/actions";
import { Bar, LABEL } from "./pick-ui";
import { KnockoutCascade } from "./BracketTreeBuilder";

// The save contract shared by the pool and solo flows: a payload of the edited
// bracket, returning ok/error. The pool flow binds it to submitPicksAction with
// the pool code; the solo flow passes its own standalone-bracket save action.
export type SaveBracket = (payload: {
  entryId?: string;
  label: string;
  tiebreak: string;
  picks: Picks;
}) => Promise<{ ok: boolean; error?: string; entryId?: string }>;

// Knockout-only bracket builder: the 32 qualifiers are fixed by the official R32
// seed, so the picker only chooses a winner for each match (R32 → Final), plus a
// single goals-in-the-final tiebreak. No awards (most casual players can't pick
// them) and no group / third-place sections (that's the full-bracket PickForm).
// Saves through submitPicksAction by default (pool flow); the solo flow passes
// saveAction instead. The group/award halves of the payload stay empty and score
// zero, so removing the awards UI never changes a score.
export function KnockoutPickForm({
  code,
  entryId,
  initialPicks,
  initialTiebreak,
  label,
  locked,
  seed,
  provisional = false,
  early = false,
  projections,
  outrights,
  saveAction,
}: {
  code?: string;
  entryId?: string;
  initialPicks: Picks;
  initialTiebreak: string;
  label: string;
  locked: boolean;
  seed: ResolvedR32;
  // The field isn't final — some matchups are still TBD and can shift as group
  // results land. Shows a heads-up banner; TBD slots render non-pickable as usual.
  provisional?: boolean;
  // Early/projected mode: the bracket is open before the field is final, seeded
  // from current standings. R32 slots show their position ("Group A Winner") + the
  // likely candidates until the group decides. Picks are positional and carry over.
  early?: boolean;
  // Per-R32-match projection (label + ranked candidates), keyed by match number.
  projections?: Record<number, StadiumProjection>;
  // Championship odds, for the one-tap "fill favourites".
  outrights?: OutrightProb[];
  saveAction?: SaveBracket;
}) {
  // Picks are stored as an AdvanceMap (which SIDE of each match advances) — a
  // positional model that resolves to team codes against the current seed. When a
  // projected slot firms up to a different team, the same map re-resolves to it, so
  // an early pick carries forward instead of being dropped.
  const [advance, setAdvance] = useState<AdvanceMap>(() =>
    deriveAdvance((initialPicks ?? emptyPicks()).knockout, seed),
  );
  const [tiebreak, setTiebreak] = useState(initialTiebreak);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Track the bracket id across saves. When creating a new bracket the page
  // mounts with no id; the first save returns one, and we keep editing that row
  // instead of inserting another on the next save.
  const [currentEntryId, setCurrentEntryId] = useState(entryId);

  const picks = useMemo<Picks>(
    () => ({ ...emptyPicks(), knockout: resolveAdvance(advance, seed) }),
    [advance, seed],
  );
  const ko = useMemo(() => resolveKnockout(picks, seed), [picks, seed]);
  const progress = useMemo(() => knockoutOnlyProgress(picks), [picks]);

  // The card taps a side's projected team; map it back to which side advances.
  const pickWinner = (matchNo: number, teamCode: string) => {
    setSaved(null);
    const slot = [...ko.r32, ...ko.r16, ...ko.qf, ...ko.sf, ko.final].find(
      (s) => s.matchNo === matchNo,
    );
    const side = slot?.a?.code === teamCode ? "a" : slot?.b?.code === teamCode ? "b" : null;
    if (!side) return;
    setAdvance((prev) => ({ ...prev, [matchNo]: side }));
  };

  const fillFavorites = () => {
    setSaved(null);
    setAdvance(quickFillFavorites(seed, outrights ?? []));
  };

  const submit = () => {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = saveAction
        ? await saveAction({ entryId: currentEntryId, label, tiebreak, picks })
        : await submitPicksAction({ code: code ?? "", entryId: currentEntryId, label, tiebreak, picks });
      if (res.ok) {
        setSaved("Picks saved");
        if (res.entryId) setCurrentEntryId(res.entryId);
      } else setError(res.error ?? "Could not save picks.");
    });
  };

  return (
    <div className="space-y-6">
      {/* Sticky progress + save (read-only when locked: shows the bracket but no save) */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className={LABEL}>
                {locked
                  ? "Your bracket — locked"
                  : progress.complete
                    ? "Bracket complete"
                    : "Your bracket"}
              </span>
              <span className="font-mono text-xs tabular-nums text-ink-3">
                {progress.overall.done}/{progress.overall.total}
              </span>
            </div>
            <div className="mt-1.5">
              <Bar done={progress.overall.done} total={progress.overall.total} />
            </div>
          </div>
          {locked ? null : (
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-pitch px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save picks"}
            </button>
          )}
        </div>
        {!locked && saved ? (
          <p className="mt-2 text-xs font-semibold text-positive">✓ {saved}</p>
        ) : null}
        {!locked && error ? <p className="mt-2 text-xs font-semibold text-negative">{error}</p> : null}
      </div>

      {/* Knockout cascade */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className={LABEL}>Pick every winner</h3>
          <div className="flex items-center gap-3">
            {!locked && (early || provisional) ? (
              <button
                type="button"
                onClick={fillFavorites}
                className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-pitch hover:bg-surface-sunk active:scale-[0.98]"
              >
                Fill favourites
              </button>
            ) : null}
            <span className="font-mono text-xs tabular-nums text-ink-3">
              {progress.knockout.done}/{progress.knockout.total}
            </span>
          </div>
        </div>
        {early && !locked ? (
          <p className="rounded-xl border border-gold-dark/40 bg-gold-tint/40 px-3 py-2 text-[12px] leading-snug text-ink-2">
            <span className="font-semibold text-gold-dark">Get a head start.</span>{" "}
            The field isn&apos;t set yet, so Round-of-32 slots show their position (e.g.{" "}
            <span className="font-medium">Group A Winner</span>) with the most likely teams. Pick the
            path you fancy — each slot fills in with the real team as its group finishes, and your
            picks carry over. <span className="font-medium">Fill favourites</span> drafts the whole
            bracket from the odds in one tap.
          </p>
        ) : provisional && !locked ? (
          <p className="rounded-xl border border-gold-dark/40 bg-gold-tint/40 px-3 py-2 text-[12px] leading-snug text-ink-2">
            <span className="font-semibold text-gold-dark">Seeding isn&apos;t final yet.</span>{" "}
            Get a head start now — matchups still marked <span className="font-mono">TBD</span> unlock
            as the last group results land.
          </p>
        ) : null}
        <KnockoutCascade
          ko={ko}
          disabled={locked}
          onPick={pickWinner}
          projections={early ? projections : undefined}
        />
      </section>

      {/* Tiebreaker */}
      <section>
        <h3 className={`${LABEL} mb-2`}>Tiebreaker</h3>
        <div className="space-y-3 rounded-md border border-line bg-surface p-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">
              Total goals in the final
            </span>
            <input
              value={tiebreak}
              onChange={(e) => {
                setSaved(null);
                setTiebreak(e.target.value);
              }}
              disabled={locked}
              inputMode="numeric"
              maxLength={3}
              placeholder="e.g. 3"
              className="h-10 w-24 rounded border border-line bg-surface px-2.5 text-sm tabular-nums text-ink outline-none focus:border-pitch disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>
        </div>
      </section>

      {/* Bottom save (mirrors the sticky one for long scrolls) — hidden when locked */}
      {locked ? null : (
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-pitch px-4 font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Saving…" : progress.complete ? "Save complete bracket" : "Save picks"}
        </button>
      )}
    </div>
  );
}
