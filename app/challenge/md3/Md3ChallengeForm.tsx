"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type MouseEvent } from "react";
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

// A day-chunked list of fixture cards. Day headers are computed within the list
// it's given, so it reads correctly whether it holds the open or closed segment.
function FixtureList({ fixtures, canEdit }: { fixtures: Md3FixtureVM[]; canEdit: boolean }) {
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
          <FixtureCard f={f} disabled={!canEdit || f.locked} />
        </li>
      ))}
    </ul>
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
  // True when the signed-in user hasn't yet accepted the terms — the save button
  // opens a one-time consent popup (this entry carries a prize) before submitting.
  needsConsent?: boolean;
}) {
  const [state, action, pending] = useActionState<SaveMd3ChallengeState, FormData>(
    saveMd3ChallengeEntry,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Consent is captured via a popup rather than an inline checkbox: the sticky
  // save bar (and the fixed bottom nav) could hide a checkbox placed in the form
  // flow. Once agreed, the hidden `agreed` input is "on" and we submit the form
  // programmatically — the server action then records consent.
  const [agreed, setAgreed] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    if (agreed) formRef.current?.requestSubmit();
  }, [agreed]);

  // Intercept the first save when consent is still needed: open the popup instead
  // of submitting. After agreement (or when consent isn't required) submit runs.
  function handleSave(e: MouseEvent<HTMLButtonElement>) {
    if (needsConsent && !agreed) {
      e.preventDefault();
      setShowConsent(true);
    }
  }

  // Frontload the fixtures you can still pick — split open (not yet kicked off)
  // from closed (locked/final). Open ones lead the form; closed ones drop into a
  // collapsed section below so the pickable games aren't buried under scores you
  // can no longer change.
  const open = fixtures.filter((f) => !f.locked);
  const closed = fixtures.filter((f) => f.locked);

  return (
    <>
      <form ref={formRef} action={action} className="space-y-3">
        {open.length > 0 ? (
          <FixtureList fixtures={open} canEdit={canEdit} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
            No fixtures open right now — every remaining match has kicked off.
          </p>
        )}

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
          <input type="hidden" name="agreed" value={agreed ? "on" : ""} />
        ) : null}

        {canEdit && open.length > 0 ? (
          <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] pt-1">
            <button
              type="submit"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white shadow-[var(--shadow-md)] transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save predictions"}
            </button>
          </div>
        ) : null}
      </form>

      {/* Closed fixtures — kicked off, so read-only. Collapsed by default and shown
          below the pickable games; each still surfaces your prediction next to the
          live/final score. */}
      {closed.length > 0 ? (
        <details className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface-sunk/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
            <span>Closed fixtures</span>
            <span className="text-[12px] font-normal text-ink-3">{closed.length} kicked off ›</span>
          </summary>
          <div className="px-3 pb-3">
            <FixtureList fixtures={closed} canEdit={false} />
          </div>
        </details>
      ) : null}

      {showConsent ? (
        <ConsentPopup
          pending={pending}
          onCancel={() => setShowConsent(false)}
          onAgree={() => {
            setShowConsent(false);
            setAgreed(true);
          }}
        />
      ) : null}
    </>
  );
}

// One-time consent popup shown when a signed-in user enters the prize challenge
// for the first time. Rendered above the fixed bottom nav (z-50 over its z-40) so
// it can't be hidden the way the old inline checkbox was. Backdrop click or Escape
// cancels; "Agree & save" records consent and submits.
function ConsentPopup({
  onAgree,
  onCancel,
  pending,
}: {
  onAgree: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="md3-consent-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[420px] rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="md3-consent-title" className="font-display text-lg text-ink">
          One quick confirm
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Match Day Pickem carries a real prize. By entering you confirm you&apos;re 18+ and agree
          to our{" "}
          <Link href="/terms" className="font-semibold text-pitch hover:underline">Terms</Link>,{" "}
          <Link href="/privacy" className="font-semibold text-pitch hover:underline">Privacy Policy</Link>{" "}
          and{" "}
          <Link href="/rules" className="font-semibold text-pitch hover:underline">Official Rules</Link>.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-line bg-surface px-4 font-semibold text-ink-2 transition-colors hover:bg-surface-sunk"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAgree}
            disabled={pending}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-pitch px-4 font-semibold text-white shadow-[var(--shadow-md)] transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-60"
          >
            Agree &amp; save
          </button>
        </div>
      </div>
    </div>
  );
}
