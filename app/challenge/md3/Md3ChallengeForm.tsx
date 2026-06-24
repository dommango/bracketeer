"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveMd3ChallengeEntry, type SaveMd3ChallengeState } from "./actions";
import type { Md3FixtureVM } from "@/lib/pool/md3-view";

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
        {rows.map(({ f, day, showDay }) => {
          const disabled = !canEdit || f.locked;
          return (
            <li key={f.matchNo}>
              {showDay ? (
                <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
                  {day}
                </p>
              ) : null}
              <div className="rounded-2xl border border-line bg-surface p-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  <span>Group {f.group}</span>
                  <span>
                    {f.locked ? "Locked · " : ""}
                    {kickoffLabel(f.kickoffISO)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-right text-[15px] font-semibold text-ink">
                    {f.homeName}
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
                  <span className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold text-ink">
                    {f.awayName}
                  </span>
                </div>

                {f.result ? (
                  <div className="mt-2 flex items-center justify-center gap-2 text-[12px] text-ink-3">
                    <span className="font-semibold text-ink-2">
                      {f.result.final ? "Final" : "Live"} {f.result.home}–{f.result.away}
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
            </li>
          );
        })}
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
