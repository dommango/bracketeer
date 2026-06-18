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

function SectionCards({ matches, code, accent }: { matches: MatchCenterRow[]; code: string; accent: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {matches.map((row) => (
        <MatchRow key={row.matchNo} row={row} code={code} accent={accent} />
      ))}
    </div>
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

  // In the by-day view, finished days arrive as leading collapsed sections
  // (collapsible && !defaultOpen) — chronological, so they're contiguous at the
  // front. Tuck them ALL under one "Previous days" expandable rather than one
  // <details> per day; the live/upcoming days then read as plain dated headers.
  // Other views carry no collapsed leaders, so this is a no-op for them.
  let pastCount = 0;
  while (pastCount < sections.length && sections[pastCount].collapsible && !sections[pastCount].defaultOpen) {
    pastCount++;
  }
  const pastDays = sections.slice(0, pastCount);
  const rest = sections.slice(pastCount);
  const pastMatchCount = pastDays.reduce((n, s) => n + s.matches.length, 0);

  return (
    <div className="space-y-5">
      {pastDays.length > 0 ? (
        <details className="group">
          <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3 [&::-webkit-details-marker]:hidden">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--pitch)" }} />
            Previous days
            <span className="ml-auto flex items-center gap-1 font-medium normal-case tracking-normal text-ink-4">
              {pastMatchCount} {pastMatchCount === 1 ? "match" : "matches"}
              <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
            </span>
          </summary>
          <div className="space-y-4">
            {pastDays.map((section) => (
              <div key={section.label}>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">
                  {section.label}
                </h4>
                <SectionCards
                  matches={section.matches}
                  code={code}
                  accent={ROUND_ACCENT[section.roundCode] ?? "var(--line)"}
                />
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {rest.map((section) => {
        const accent = ROUND_ACCENT[section.roundCode] ?? "var(--line)";

        // By-day current/upcoming slates: a plain dated header (the only
        // collapsing is the Previous-days group above).
        if (section.collapsible) {
          return (
            <div key={section.label}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                {section.label}
              </h3>
              <SectionCards matches={section.matches} code={code} accent={accent} />
            </div>
          );
        }

        return (
          <div key={section.anchor ?? section.label} id={section.anchor} className={section.anchor ? "scroll-mt-20" : undefined}>
            {/* An empty label (e.g. the stadium view's single ungrouped list)
                renders just the cards, with no section heading. */}
            {section.label ? (
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                {section.label}
              </h3>
            ) : null}
            <SectionCards matches={section.matches} code={code} accent={accent} />
          </div>
        );
      })}
    </div>
  );
}
