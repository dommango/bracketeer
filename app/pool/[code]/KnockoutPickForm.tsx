"use client";

import { useMemo, useState, useTransition } from "react";
import {
  resolveKnockout,
  reconcileKnockoutPicks,
  knockoutOnlyProgress,
  type KnockoutSlot,
} from "@/lib/pool/pick-form";
import type { ResolvedR32 } from "@/lib/scoring/resolve";
import { emptyPicks, type Picks } from "@/lib/scoring/types";
import { submitPicksAction } from "./picks/actions";
import { AWARDS, Bar, KO_STAGES, KnockoutMatch, LABEL } from "./pick-ui";

// The save contract shared by the pool and solo flows: a payload of the edited
// bracket, returning ok/error. The pool flow binds it to submitPicksAction with
// the pool code; the solo flow passes its own master-pool save action.
export type SaveBracket = (payload: {
  entryId?: string;
  label: string;
  tiebreak: string;
  picks: Picks;
}) => Promise<{ ok: boolean; error?: string }>;

// Knockout-only bracket builder: the 32 qualifiers are fixed by the official R32
// seed, so the picker only chooses a winner for each match (R32 → Final), plus
// awards + tiebreak. No group / third-place sections (that's the full-bracket
// PickForm). Saves through submitPicksAction by default (pool flow); the solo
// flow passes saveAction instead. The group halves of the payload stay empty and
// score zero.
export function KnockoutPickForm({
  code,
  entryId,
  initialPicks,
  initialTiebreak,
  label,
  locked,
  seed,
  saveAction,
}: {
  code?: string;
  entryId?: string;
  initialPicks: Picks;
  initialTiebreak: string;
  label: string;
  locked: boolean;
  seed: ResolvedR32;
  saveAction?: SaveBracket;
}) {
  const [picks, setPicks] = useState<Picks>(() =>
    reconcileKnockoutPicks(initialPicks ?? emptyPicks(), seed),
  );
  const [tiebreak, setTiebreak] = useState(initialTiebreak);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ko = useMemo(() => resolveKnockout(picks, seed), [picks, seed]);
  const progress = useMemo(() => knockoutOnlyProgress(picks), [picks]);

  const update = (mut: (p: Picks) => Picks) => {
    setSaved(null);
    setPicks((p) => reconcileKnockoutPicks(mut(p), seed));
  };

  const pickWinner = (matchNo: number, teamCode: string) =>
    update((p) => ({ ...p, knockout: { ...p.knockout, [matchNo]: teamCode } }));

  const setAward = (key: keyof Picks["awards"], value: string) =>
    update((p) => ({ ...p, awards: { ...p.awards, [key]: value } }));

  const submit = () => {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = saveAction
        ? await saveAction({ entryId, label, tiebreak, picks })
        : await submitPicksAction({ code: code ?? "", entryId, label, tiebreak, picks });
      if (res.ok) setSaved("Picks saved");
      else setError(res.error ?? "Could not save picks.");
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
        <div className="flex items-center justify-between">
          <h3 className={LABEL}>Pick every winner</h3>
          <span className="font-mono text-xs tabular-nums text-ink-3">
            {progress.knockout.done}/{progress.knockout.total}
          </span>
        </div>
        {KO_STAGES.map((stage) => {
          const slots = ko[stage.key] as KnockoutSlot[];
          return (
            <div key={stage.key}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                {stage.label}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {slots.map((slot) => (
                  <KnockoutMatch
                    key={slot.matchNo}
                    slot={slot}
                    disabled={locked}
                    onPick={pickWinner}
                  />
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
            <KnockoutMatch slot={ko.final} disabled={locked} onPick={pickWinner} />
          </div>
        </div>
      </section>

      {/* Awards + tiebreak */}
      <section>
        <h3 className={`${LABEL} mb-2`}>Awards &amp; tiebreaker</h3>
        <div className="space-y-3 rounded-md border border-line bg-surface p-3">
          {AWARDS.map((a) => (
            <label key={a.key} className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink-2">{a.label}</span>
              <input
                value={picks.awards[a.key] ?? ""}
                onChange={(e) => setAward(a.key, e.target.value)}
                disabled={locked}
                maxLength={60}
                placeholder="Player or team name"
                className="h-10 w-full rounded border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-pitch disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">
              Tiebreaker — total goals in the final
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
