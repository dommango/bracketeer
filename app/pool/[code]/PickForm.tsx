"use client";

import { useMemo, useState, useTransition } from "react";
import { GROUPS, TEAMS } from "@/lib/scoring/data";
import {
  resolveKnockout,
  pickFormProgress,
  validatePicks,
  TARGET_THIRDS,
  type KnockoutSlot,
} from "@/lib/pool/pick-form";
import { emptyPicks, type Picks } from "@/lib/scoring/types";
import { submitPicksAction } from "./picks/actions";
import { Flag } from "./Flag";

const AWARDS: { key: keyof Picks["awards"]; label: string }[] = [
  { key: "player", label: "Player of the tournament" },
  { key: "young", label: "Best young player" },
  { key: "boot", label: "Golden Boot (top scorer)" },
  { key: "goal", label: "Best goal" },
];

const KO_STAGES: { key: keyof ReturnType<typeof resolveKnockout>; label: string }[] = [
  { key: "r32", label: "Round of 32" },
  { key: "r16", label: "Round of 16" },
  { key: "qf", label: "Quarter-finals" },
  { key: "sf", label: "Semi-finals" },
];

// Drop any knockout pick that no longer matches its (re-resolved) matchup after
// an upstream change, iterating forward until the bracket is internally consistent.
function reconcile(picks: Picks): Picks {
  let next = picks;
  for (let pass = 0; pass < 6; pass++) {
    const ko = resolveKnockout(next);
    const slots = [...ko.r32, ...ko.r16, ...ko.qf, ...ko.sf, ko.final];
    const knockout: Record<number, string> = { ...next.knockout };
    let changed = false;
    for (const s of slots) {
      const pick = knockout[s.matchNo];
      if (pick && pick !== s.a?.code && pick !== s.b?.code) {
        delete knockout[s.matchNo];
        changed = true;
      }
    }
    if (!changed) return next;
    next = { ...next, knockout };
  }
  return next;
}

function Bar({ done, total }: { done: number; total: number }) {
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

const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

function TeamOption({ code }: { code: string }) {
  return (
    <option value={code}>
      {TEAMS[code] ?? code}
    </option>
  );
}

// Single-tap winner selection styled like the design system's PickSelector:
// two big centered options (real flag, display-font code, name), a "vs"
// divider, and a solid pitch-green picked state.
function KnockoutMatch({
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

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 px-0.5 font-mono text-[11px] font-bold text-ink-3">M{slot.matchNo}</div>
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

export function PickForm({
  code,
  entryId,
  initialPicks,
  initialTiebreak,
  label,
  locked,
}: {
  code: string;
  entryId?: string;
  initialPicks: Picks;
  initialTiebreak: string;
  label: string;
  locked: boolean;
}) {
  const [picks, setPicks] = useState<Picks>(() => reconcile(initialPicks ?? emptyPicks()));
  const [tiebreak, setTiebreak] = useState(initialTiebreak);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ko = useMemo(() => resolveKnockout(picks), [picks]);
  const progress = useMemo(() => pickFormProgress(picks), [picks]);
  const issues = useMemo(() => validatePicks(picks), [picks]);

  const letters = Object.keys(GROUPS);
  const thirdsCount = picks.thirdAdvance.length;

  const update = (mut: (p: Picks) => Picks) => {
    setSaved(null);
    setPicks((p) => reconcile(mut(p)));
  };

  const setGroupPlace = (g: string, place: "groupFirst" | "groupSecond", code: string) =>
    update((p) => ({ ...p, [place]: { ...p[place], [g]: code } }));

  const toggleThird = (teamCode: string) =>
    update((p) => {
      const has = p.thirdAdvance.includes(teamCode);
      if (!has && p.thirdAdvance.length >= TARGET_THIRDS) return p;
      return {
        ...p,
        thirdAdvance: has
          ? p.thirdAdvance.filter((c) => c !== teamCode)
          : [...p.thirdAdvance, teamCode],
      };
    });

  const pickWinner = (matchNo: number, teamCode: string) =>
    update((p) => ({ ...p, knockout: { ...p.knockout, [matchNo]: teamCode } }));

  const setAward = (key: keyof Picks["awards"], value: string) =>
    update((p) => ({ ...p, awards: { ...p.awards, [key]: value } }));

  const submit = () => {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await submitPicksAction({ code, entryId, label, tiebreak, picks });
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
                {locked ? "Your bracket — locked" : progress.complete ? "Bracket complete" : "Your bracket"}
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
              disabled={pending || issues.length > 0}
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
        {!locked && issues.length > 0 ? (
          <p className="mt-2 text-xs text-negative">{issues[0]}</p>
        ) : null}
      </div>

      {/* Groups */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className={LABEL}>Group stage · 1st &amp; 2nd</h3>
          <span className="font-mono text-xs tabular-nums text-ink-3">
            {progress.groups.done}/{progress.groups.total}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {letters.map((g) => {
            const teams = GROUPS[g];
            const first = picks.groupFirst[g] ?? "";
            const second = picks.groupSecond[g] ?? "";
            const thirdCandidates = teams.filter((t) => t !== first && t !== second);
            return (
              <div key={g} className="rounded-md border border-line bg-surface p-3">
                <p className="mb-2 font-display text-sm text-ink">Group {g}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                      1st
                    </span>
                    <select
                      value={first}
                      onChange={(e) => setGroupPlace(g, "groupFirst", e.target.value)}
                      disabled={locked}
                      className="h-10 w-full rounded border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-pitch disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="">—</option>
                      {teams.map((t) => (
                        <TeamOption key={t} code={t} />
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                      2nd
                    </span>
                    <select
                      value={second}
                      onChange={(e) => setGroupPlace(g, "groupSecond", e.target.value)}
                      disabled={locked}
                      className="h-10 w-full rounded border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-pitch disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="">—</option>
                      {teams.map((t) => (
                        <TeamOption key={t} code={t} />
                      ))}
                    </select>
                  </label>
                </div>
                {first && second ? (
                  <div className="mt-2">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                      3rd place advances?
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {thirdCandidates.map((t) => {
                        const on = picks.thirdAdvance.includes(t);
                        const blocked = !on && thirdsCount >= TARGET_THIRDS;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleThird(t)}
                            disabled={blocked || locked}
                            aria-pressed={on}
                            className={`inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pitch ${
                              on
                                ? "bg-pitch text-white"
                                : "bg-surface-sunk text-ink hover:bg-pitch-tint disabled:opacity-40"
                            }`}
                          >
                            <Flag code={t} size={14} />
                            {TEAMS[t] ?? t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {thirdsCount}/{TARGET_THIRDS} third-place teams advancing.
        </p>
      </section>

      {/* Knockout cascade */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={LABEL}>Knockout — pick every winner</h3>
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
          disabled={pending || issues.length > 0}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-pitch px-4 font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Saving…" : progress.complete ? "Save complete bracket" : "Save picks"}
        </button>
      )}
    </div>
  );
}
