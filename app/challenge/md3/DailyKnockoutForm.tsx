"use client";

import { useActionState } from "react";
import { saveDailyKnockoutEntry, type SaveDailyKnockoutState } from "./daily-actions";
import type { DailyKnockoutFixtureVM } from "@/lib/pool/daily-knockout-view";
import type { Stage } from "@/lib/games/stage";
import { Flag } from "@/app/pool/[code]/Flag";
import { WinProbBar } from "@/app/pool/[code]/WinProbBar";

// Per-round accent + label, so each knockout stage reads as its own band of the
// bracket (mirrors the group-stage accent treatment in Md3ChallengeForm).
const STAGE_ACCENT: Record<Stage, string> = {
  GROUP: "var(--pitch)",
  R32: "var(--pitch)",
  R16: "var(--gold-dark, #9a7b1f)",
  QF: "var(--gold-dark, #9a7b1f)",
  SF: "var(--live, #c0392b)",
  FINAL: "var(--live, #c0392b)",
};
const STAGE_LABEL: Record<Stage, string> = {
  GROUP: "Group",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  FINAL: "Final",
};

function dayLabel(iso: string | null): string {
  if (!iso) return "To be scheduled";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function kickoffLabel(iso: string | null): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const SCORE_BOX =
  "h-11 w-12 rounded-lg border border-line bg-surface text-center text-[17px] font-semibold text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)] disabled:bg-surface-sunk disabled:text-ink-3";

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
      Live
    </span>
  );
}

function FixtureCard({ f, disabled }: { f: DailyKnockoutFixtureVM; disabled: boolean }) {
  const final = f.result?.final ?? false;
  const accent = STAGE_ACCENT[f.stage];
  const awaiting = !f.open;
  return (
    <div
      className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          {STAGE_LABEL[f.stage]}
        </span>
        {f.result && !final ? (
          <LiveBadge />
        ) : final ? (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Final
          </span>
        ) : awaiting ? (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Awaiting teams
          </span>
        ) : (
          <span className="font-mono text-[11px] text-ink-3">
            {f.locked ? "Locked · " : ""}
            {kickoffLabel(f.kickoffISO)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{f.homeName}</span>
          {f.homeCode ? <Flag code={f.homeCode} size={22} /> : null}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          name={`home_${f.matchNo}`}
          defaultValue={f.pred ? f.pred.home : ""}
          disabled={disabled}
          aria-label={`${f.homeName} goals`}
          className={SCORE_BOX}
        />
        <span className="text-ink-4">–</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          name={`away_${f.matchNo}`}
          defaultValue={f.pred ? f.pred.away : ""}
          disabled={disabled}
          aria-label={`${f.awayName} goals`}
          className={SCORE_BOX}
        />
        <span className="flex min-w-0 flex-1 items-center justify-start gap-2">
          {f.awayCode ? <Flag code={f.awayCode} size={22} /> : null}
          <span className="truncate text-[15px] font-semibold text-ink">{f.awayName}</span>
        </span>
      </div>

      {!final && !awaiting ? (
        <WinProbBar odds={f.odds} homeCode={f.homeCode ?? ""} awayCode={f.awayCode ?? ""} />
      ) : null}

      {f.result ? (
        <div className="mt-2 flex items-center justify-center gap-2 text-[12px]">
          <span className="font-semibold text-ink-2">
            {final ? "Final" : "Live"} {f.result.home}–{f.result.away}
          </span>
          {f.points !== null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                f.points > 0 ? "bg-pitch-tint text-pitch-dark" : "bg-surface-sunk text-ink-3"
              }`}
            >
              +{f.points}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// A day-chunked list of fixture cards. Day headers are computed within the given
// list, so it reads correctly whether it holds the open, awaiting or closed segment.
function FixtureList({ fixtures, canEdit }: { fixtures: DailyKnockoutFixtureVM[]; canEdit: boolean }) {
  const rows = fixtures.map((f, i) => {
    const day = dayLabel(f.kickoffISO);
    const showDay = i === 0 || day !== dayLabel(fixtures[i - 1].kickoffISO);
    return { f, day, showDay };
  });
  return (
    <ul className="space-y-2">
      {rows.map(({ f, day, showDay }) => (
        <li key={f.matchNo}>
          {showDay ? (
            <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
              {day}
            </p>
          ) : null}
          <FixtureCard f={f} disabled={!canEdit || f.locked || !f.open} />
        </li>
      ))}
    </ul>
  );
}

export function DailyKnockoutForm({
  fixtures,
  canEdit,
}: {
  fixtures: DailyKnockoutFixtureVM[];
  // False when signed out or the game is fully locked (read-only).
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<SaveDailyKnockoutState, FormData>(
    saveDailyKnockoutEntry,
    {},
  );

  // Open = seated and not yet kicked off (pickable, leads the form).
  // Awaiting = competitors not decided yet (shown, read-only, sits after open).
  // Closed = kicked off / final (collapsed, read-only, pinned to top).
  const open = fixtures.filter((f) => f.open && !f.locked);
  const awaiting = fixtures.filter((f) => !f.open);
  const closed = fixtures.filter((f) => f.open && f.locked);

  return (
    <>
      {closed.length > 0 ? (
        <details className="mb-3 overflow-hidden rounded-2xl border border-line bg-surface-sunk/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
            <span>Closed fixtures</span>
            <span className="text-[12px] font-normal text-ink-3">{closed.length} kicked off ›</span>
          </summary>
          <div className="px-3 pb-3">
            <FixtureList fixtures={closed} canEdit={false} />
          </div>
        </details>
      ) : null}

      <form action={action} className="space-y-3">
        {open.length > 0 ? (
          <FixtureList fixtures={open} canEdit={canEdit} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
            No fixtures open to pick right now — check back as the next round&apos;s teams are decided.
          </p>
        )}

        {awaiting.length > 0 ? (
          <details className="overflow-hidden rounded-2xl border border-line bg-surface-sunk/30">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
              <span>Upcoming rounds</span>
              <span className="text-[12px] font-normal text-ink-3">
                {awaiting.length} awaiting teams ›
              </span>
            </summary>
            <div className="px-3 pb-3">
              <FixtureList fixtures={awaiting} canEdit={false} />
            </div>
          </details>
        ) : null}

        {state.error ? (
          <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="rounded-md border border-pitch/30 bg-pitch/5 px-3 py-2 text-sm text-pitch-dark">
            Predictions saved — you&apos;re on the knockout board.
          </p>
        ) : null}

        {canEdit && open.length > 0 ? (
          <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] pt-1">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white shadow-[var(--shadow-md)] transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save predictions"}
            </button>
          </div>
        ) : null}
      </form>
    </>
  );
}
