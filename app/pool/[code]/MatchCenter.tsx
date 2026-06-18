import Link from "next/link";
import type { MatchCenterSection, MatchCenterRow, MatchCenterSide } from "@/lib/pool/match-center";
import { formatKickoff } from "@/lib/pool/format";
import { Flag } from "./Flag";
import { VenueLine } from "./VenueLine";
import { WinProbBar } from "./WinProbBar";
import { UpsetBadge } from "./UpsetBadge";

// Same chromatic round sweep as the bracket (group green → gold final).
const ROUND_ACCENT: Record<string, string> = {
  GROUP: "var(--pitch)",
  R32: "var(--round-r32)",
  R16: "var(--round-r16)",
  QF: "var(--round-qf)",
  SF: "var(--round-sf)",
  BRONZE: "var(--gold-dark)",
  FINAL: "var(--round-final)",
};

function StatusBadge({ status }: { status: MatchCenterRow["status"] }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
        Live
      </span>
    );
  }
  if (status === "FINAL") {
    return (
      <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
        Final
      </span>
    );
  }
  return null;
}

function Side({ side, isWinner, decided }: { side: MatchCenterSide; isWinner: boolean; decided: boolean }) {
  const dimmed = decided && !isWinner;
  return (
    <div className={`flex items-center gap-2.5 py-1 ${dimmed ? "text-ink-4" : "text-ink"}`}>
      <Flag code={side.code} size={20} />
      <span className={`flex-1 truncate ${isWinner ? "font-bold" : "font-medium"}`}>
        {side.name}
        {side.code ? (
          <span className={`ml-1.5 font-mono text-[10px] ${dimmed ? "text-ink-4" : "text-ink-3"}`}>
            {side.code}
          </span>
        ) : null}
      </span>
      {side.score !== null ? (
        <span className="font-mono text-base font-bold tabular-nums">{side.score}</span>
      ) : null}
    </div>
  );
}

function PickChip({ pick }: { pick: NonNullable<MatchCenterRow["yourPick"]> }) {
  const tone =
    pick.correct === true
      ? { bg: "var(--positive)", label: `✓ Your pick: ${pick.name}` }
      : pick.correct === false
        ? { bg: "var(--negative)", label: `✗ Your pick: ${pick.name}` }
        : { bg: "var(--ink-3)", label: `Your pick: ${pick.name}` };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-white"
      style={{ background: tone.bg }}
    >
      {tone.label}
    </span>
  );
}

function MatchRow({ row, code, accent }: { row: MatchCenterRow; code: string; accent: string }) {
  const decided = row.status === "FINAL" && Boolean(row.winnerCode);
  return (
    <Link
      href={`/pool/${code}/matches/${row.matchNo}`}
      className="block rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm shadow-[var(--shadow-xs)] transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-1 flex items-center justify-end gap-2">
        <UpsetBadge status={row.status} homeScore={row.home.score} awayScore={row.away.score} odds={row.odds} />
        <StatusBadge status={row.status} />
        {row.status === "SCHEDULED" && row.scheduledAt ? (
          <span className="font-mono text-[10px] text-ink-3">{formatKickoff(row.scheduledAt)}</span>
        ) : null}
      </div>
      <Side side={row.home} isWinner={decided && row.winnerCode === row.home.code} decided={decided} />
      <div className="my-0.5 h-px bg-line-soft" />
      <Side side={row.away} isWinner={decided && row.winnerCode === row.away.code} decided={decided} />
      {row.yourPick ? (
        <div className="mt-1.5">
          <PickChip pick={row.yourPick} />
        </div>
      ) : null}
      <div className="mt-1.5">
        <VenueLine venue={row.venue} city={row.city} cityToken={row.cityToken} />
      </div>
      {/* Pre-match odds are meaningless once a game is final, so drop them. While
          LIVE the feed refreshes them in-play — call that out so they're not read
          as stale pre-match numbers. */}
      {row.status !== "FINAL" ? (
        <>
          <WinProbBar odds={row.odds} homeCode={row.home.code} awayCode={row.away.code} />
          {row.status === "LIVE" && row.odds ? (
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-live">
              Live odds · refreshed in-play
            </p>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

export function MatchCenter({ sections, code }: { sections: MatchCenterSection[]; code: string }) {
  if (sections.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        No fixtures yet.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const accent = ROUND_ACCENT[section.roundCode] ?? "var(--line)";
        const grid = (
          <div className="grid gap-2 sm:grid-cols-2">
            {section.matches.map((row) => (
              <MatchRow key={row.matchNo} row={row} code={code} accent={accent} />
            ))}
          </div>
        );

        // Collapsible sections (the by-day view) fold finished days away by
        // default via a native <details> — past slates collapse, the live/
        // upcoming day stays open. No client JS needed.
        if (section.collapsible) {
          return (
            <details key={section.label} open={section.defaultOpen} className="group">
              <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3 [&::-webkit-details-marker]:hidden">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                {section.label}
                <span className="ml-auto flex items-center gap-1 font-medium normal-case tracking-normal text-ink-4">
                  {section.matches.length} {section.matches.length === 1 ? "match" : "matches"}
                  <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>
              {grid}
            </details>
          );
        }

        return (
          <div key={section.label} id={section.anchor} className={section.anchor ? "scroll-mt-20" : undefined}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
              {section.label}
            </h3>
            {grid}
          </div>
        );
      })}
    </div>
  );
}
