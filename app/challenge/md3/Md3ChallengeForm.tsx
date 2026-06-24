"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveMd3ChallengeEntry, type SaveMd3ChallengeState } from "./actions";
import type { Md3FixtureVM } from "@/lib/pool/md3-view";
import { Flag } from "@/app/pool/[code]/Flag";
import { WinProbBar } from "@/app/pool/[code]/WinProbBar";

// Group fixtures by kickoff day for light visual chunking.
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function kickoffLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const SCORE_BOX =
  "h-11 w-12 rounded-lg border border-line bg-surface text-center text-[17px] font-semibold text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)] disabled:bg-surface-sunk disabled:text-ink-3";

// Group-stage accent — matches the ScoreCards / MatchCenter round accent so the
// pickem cards read as the same family of fixtures.
const GROUP_ACCENT = "var(--pitch)";

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
      Live
    </span>
  );
}

function FixtureCard({ f, disabled }: { f: Md3FixtureVM; disabled: boolean }) {
  const final = f.result?.final ?? false;
  return (
    <div
      className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]"
      style={{ borderLeft: `4px solid ${GROUP_ACCENT}` }}
    >
      {/* Header: group label (with accent dot) + status — mirrors the ScoreCards header. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_ACCENT }} />
          Group {f.group}
        </span>
        {f.result && !final ? (
          <LiveBadge />
        ) : final ? (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Final
          </span>
        ) : (
          <span className="font-mono text-[11px] text-ink-3">
            {f.locked ? "Locked · " : ""}
            {kickoffLabel(f.kickoffISO)}
          </span>
        )}
      </div>

      {/* Horizontal head-to-head: home (name · flag) — score inputs — away (flag · name). */}
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{f.homeName}</span>
          <Flag code={f.homeCode} size={22} />
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
          <Flag code={f.awayCode} size={22} />
          <span className="truncate text-[15px] font-semibold text-ink">{f.awayName}</span>
        </span>
      </div>

      {/* Pre-match win/draw/win bar — dropped once final (stale), like ScoreCards. */}
      {!final ? <WinProbBar odds={f.odds} homeCode={f.homeCode} awayCode={f.awayCode} /> : null}

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

export function Md3ChallengeForm({
  fixtures,
  canEdit,
  needsConsent = false,
}: {
  fixtures: Md3FixtureVM[];
  // False when signed out or the game is fully locked (read-only).
  canEdit: boolean;
  // True when the signed-in user hasn't yet accepted the terms — show the
  // one-time consent checkbox (this entry carries a prize).
  needsConsent?: boolean;
}) {
  const [state, action, pending] = useActionState<SaveMd3ChallengeState, FormData>(
    saveMd3ChallengeEntry,
    {},
  );

  const rows = fixtures.map((f, i) => {
    const day = dayLabel(f.kickoffISO);
    const showDay = i === 0 || day !== dayLabel(fixtures[i - 1].kickoffISO);
    return { f, day, showDay };
  });

  return (
    <form action={action} className="space-y-3">
      <ul className="space-y-2">
        {rows.map(({ f, day, showDay }) => (
          <li key={f.matchNo}>
            {showDay ? (
              <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
                {day}
              </p>
            ) : null}
            <FixtureCard f={f} disabled={!canEdit || f.locked} />
          </li>
        ))}
      </ul>

      {state.error ? (
        <p className="rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md border border-pitch/30 bg-pitch/5 px-3 py-2 text-sm text-pitch-dark">
          Predictions saved — you&apos;re in the challenge.
        </p>
      ) : null}

      {canEdit && needsConsent ? (
        <label className="flex items-start gap-2 px-1 text-[12px] text-ink-3">
          <input type="checkbox" name="agreed" required className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            I&apos;m 18+ and agree to the{" "}
            <Link href="/terms" className="font-semibold text-pitch hover:underline">Terms</Link>,{" "}
            <Link href="/privacy" className="font-semibold text-pitch hover:underline">Privacy Policy</Link>{" "}
            and{" "}
            <Link href="/rules" className="font-semibold text-pitch hover:underline">Official Rules</Link>.
          </span>
        </label>
      ) : null}

      {canEdit ? (
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
  );
}
