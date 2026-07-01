"use client";

// Shared presentational pieces for the bracket builders (full-bracket PickForm and
// the knockout-only KnockoutPickForm): the progress bar, the section label style,
// and the single-tap winner-selection matchup card.

import { resolveKnockout, type KnockoutSlot } from "@/lib/pool/pick-form";
import type { Picks } from "@/lib/scoring/types";
import type { StadiumProjection, R32SlotProjection } from "@/lib/pool/stadium-projection";
import type { KnockoutCardInfo } from "@/lib/pool/queries-odds";
import { ROUND_ACCENT, roundCodeForMatch } from "@/lib/pool/bracket-tree";
import { slotLabel, KNOCKOUT_SLOT_REFS } from "@/lib/pool/slot-label";
import { kickoffFor, venueFor } from "@/lib/scoring/schedule";
import { formatKickoff } from "@/lib/pool/format";
import { Flag } from "./Flag";
import { WinProbBar } from "./WinProbBar";

// Re-exported from the shared module so the bracket builders can keep importing it
// from here while the single source of truth lives in lib/ui/labels.ts.
export { LABEL } from "@/lib/ui/labels";

// The four scored awards + the four knockout cascade stages (Final is rendered
// separately), shared by both bracket builders so their copy can't drift.
export const AWARDS: { key: keyof Picks["awards"]; label: string }[] = [
  { key: "player", label: "Player of the tournament" },
  { key: "young", label: "Best young player" },
  { key: "boot", label: "Golden Boot (top scorer)" },
  { key: "goal", label: "Best goal" },
];

export const KO_STAGES: { key: keyof ReturnType<typeof resolveKnockout>; label: string }[] = [
  { key: "r32", label: "Round of 32" },
  { key: "r16", label: "Round of 16" },
  { key: "qf", label: "Quarter-finals" },
  { key: "sf", label: "Semi-finals" },
];

export function Bar({ done, total }: { done: number; total: number }) {
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

// A side's ranked candidates as "MEX 78% · USA 15%" (top few), for projected R32
// slots whose occupant isn't decided yet.
function candidateLine(proj: R32SlotProjection): string {
  return proj.candidates
    .slice(0, 3)
    .map((c) => `${c.code} ${Math.round(c.prob * 100)}%`)
    .join(" · ");
}

// The betting + insight strip under a seated matchup: the win-probability bar, then
// a compact meta line (Over/Under goals line, each side's title-winner %, and the
// model's advice). Every field is gated on its own data, so the strip shows only
// what's been polled — and the whole block is omitted when there's nothing at all.
function MatchInsights({
  info,
  homeCode,
  awayCode,
  titleOdds,
}: {
  info: KnockoutCardInfo;
  homeCode: string | null;
  awayCode: string | null;
  titleOdds?: Record<string, number>;
}) {
  const homeTitle = homeCode ? titleOdds?.[homeCode] : undefined;
  const awayTitle = awayCode ? titleOdds?.[awayCode] : undefined;
  const pct = (x: number) => Math.round(x * 100);
  const hasMeta =
    info.totalLine != null || homeTitle != null || awayTitle != null || Boolean(info.advice);
  if (!info.oddsFetchedAt && !hasMeta) return null;

  return (
    <div className="mt-2 border-t border-line-soft pt-2">
      {info.oddsFetchedAt ? (
        <WinProbBar
          odds={{
            homeWinProb: info.homeWinProb,
            drawProb: info.drawProb,
            awayWinProb: info.awayWinProb,
          }}
          homeCode={homeCode}
          awayCode={awayCode}
        />
      ) : null}
      {hasMeta ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink-4">
          {info.totalLine != null ? (
            <span className="font-mono">O/U {info.totalLine}</span>
          ) : null}
          {homeTitle != null && homeCode ? (
            <span>
              {homeCode} title {pct(homeTitle)}%
            </span>
          ) : null}
          {awayTitle != null && awayCode ? (
            <span>
              {awayCode} title {pct(awayTitle)}%
            </span>
          ) : null}
          {info.advice ? <span className="truncate text-ink-3">{info.advice}</span> : null}
        </div>
      ) : null}
      {info.homeForm || info.awayForm ? (
        <div className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-ink-4">
          {info.homeForm ? (
            <span>
              {homeCode ?? "Home"} {info.homeForm}
            </span>
          ) : null}
          {info.awayForm ? (
            <span>
              {awayCode ?? "Away"} {info.awayForm}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Single-tap winner selection that mirrors the read-only matches-tab bracket card
// (Bracket.tsx's MatchCard/Side): the same card chrome — accent left border, the
// M-tag header, two stacked team rows (flag, name, code) split by a hairline — but
// each row is a button. Tapping a row picks that team as the winner; the picked
// row reads bold (like a decided match's winner) and the other dims.
//
// In early/projected mode the card also gets a `projection`: a side whose group
// hasn't decided shows its POSITION ("Group A Winner") with the likely teams under
// it. With `onPickSide` (the positional builder) EVERY row is tappable even with no
// team seated — you advance the *position* ("Group A Winner" beats "Group B
// Runner-up"), which resolves to the real team live; `pickedSide` highlights the
// chosen side. Without it (full-bracket PickForm) the card keeps the team-code path,
// pickable only once both teams are seated.
export function KnockoutMatch({
  slot,
  disabled,
  onPick,
  onPickSide,
  pickedSide,
  projection,
  info,
  titleOdds,
}: {
  slot: KnockoutSlot;
  disabled: boolean;
  onPick: (matchNo: number, code: string) => void;
  // Positional pick callback — when present, rows pick by side, always enabled.
  onPickSide?: (matchNo: number, side: "a" | "b") => void;
  pickedSide?: "a" | "b";
  projection?: StadiumProjection;
  // Betting + insight signals for this match (win-prob, O/U, model advice/form) and
  // the title-winner odds table — rendered under the matchup once both teams seat.
  info?: KnockoutCardInfo;
  titleOdds?: Record<string, number>;
}) {
  const positional = Boolean(onPickSide);
  const ready = Boolean(slot.a && slot.b);
  const hasPick = positional ? Boolean(pickedSide) : Boolean(slot.pick);

  const row = (sideKey: "a" | "b", side: KnockoutSlot["a"], proj?: R32SlotProjection) => {
    const picked = positional ? pickedSide === sideKey : Boolean(side && slot.pick === side.code);
    const dimmed = hasPick && !picked;
    // Show the position + candidates only while the slot is genuinely undecided.
    const showProjected = Boolean(proj && !proj.decided);
    // Headline: concrete team where seated; else the projected position label; else
    // (positional, no team, no projection — e.g. R16+ feeders) the structural slot.
    const structural = slotLabel(KNOCKOUT_SLOT_REFS[slot.matchNo]?.[sideKey === "a" ? 0 : 1]);
    const headline = showProjected ? proj!.label : side ? side.name : positional ? structural : "—";
    const canTap = positional ? !disabled : !disabled && ready && Boolean(side);
    return (
      <button
        type="button"
        disabled={!canTap}
        onClick={() => {
          if (onPickSide) onPickSide(slot.matchNo, sideKey);
          else if (side) onPick(slot.matchNo, side.code);
        }}
        aria-pressed={picked}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-[var(--dur-2)] [transition-timing-function:var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pitch disabled:cursor-not-allowed motion-reduce:transition-none ${
          picked ? "bg-pitch-tint" : "enabled:hover:bg-surface-sunk"
        }`}
      >
        <Flag code={showProjected ? null : (side?.code ?? null)} size={24} />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate ${
              picked
                ? "font-bold text-pitch-dark"
                : dimmed
                  ? "font-medium text-ink-4"
                  : "font-medium text-ink"
            }`}
          >
            {headline}
            {!showProjected && side ? (
              <span
                className={`ml-1.5 font-mono text-[10px] ${
                  picked ? "text-pitch-dark/70" : "text-ink-3"
                }`}
              >
                {side.code}
              </span>
            ) : null}
          </span>
          {showProjected && proj!.candidates.length > 0 ? (
            <span className="block truncate font-mono text-[10px] text-ink-4">
              {candidateLine(proj!)}
            </span>
          ) : null}
        </span>
        {picked ? (
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-pitch-dark">
            Pick
          </span>
        ) : null}
      </button>
    );
  };

  const accent = ROUND_ACCENT[roundCodeForMatch(slot.matchNo)] ?? "var(--line)";
  const kickoff = kickoffFor(slot.matchNo);
  const venue = venueFor(slot.matchNo);

  return (
    <div
      className="rounded-2xl border border-line bg-surface p-4 text-sm shadow-[var(--shadow-xs)]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">
            M{slot.matchNo}
          </span>
        </span>
        {kickoff ? (
          <span className="font-mono text-[10px] text-ink-3">{formatKickoff(kickoff.toISOString())}</span>
        ) : null}
      </div>
      {row("a", slot.a, projection?.a)}
      <div className="my-0.5 h-px bg-line-soft" />
      {row("b", slot.b, projection?.b)}
      {venue ? (
        <div className="mt-1.5 truncate text-[10px] text-ink-4">
          {venue.venue}
          {venue.city ? <span className="text-ink-4"> · {venue.city}</span> : null}
        </div>
      ) : null}
      {/* The odds/insights are oriented to the OFFICIAL matchup. They line up exactly
          for R32 (real qualifiers) — the only round with prices at pick time. For R16+
          a slot holds the user's predicted advancer, so the bar is only meaningful once
          that pick matches the team reality eventually seats there. */}
      {ready && info ? (
        <MatchInsights
          info={info}
          homeCode={slot.a?.code ?? null}
          awayCode={slot.b?.code ?? null}
          titleOdds={titleOdds}
        />
      ) : null}
    </div>
  );
}
