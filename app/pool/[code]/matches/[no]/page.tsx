import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getMatchDetail, type MatchDetail } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { listMessages } from "@/lib/pool/chat";
import type { PickSplit, PickSplitSlice } from "@/lib/pool/pick-split";
import { formatKickoff } from "@/lib/pool/format";
import { Flag } from "../../Flag";
import { TeamLink } from "../../TeamLink";
import { WhatIf } from "../../WhatIf";
import { Chat } from "../../Chat";
import { MatchTimeline, MatchStatsBars, TeamScorers } from "./MatchLive";
import { MatchInsights } from "./MatchInsights";
import { MatchInjuries } from "./MatchInjuries";
import { MatchLineups } from "./MatchLineups";
import { VenueLine } from "../../VenueLine";
import { WinProbBar } from "../../WinProbBar";
import { UpsetBadge } from "../../UpsetBadge";

export const dynamic = "force-dynamic";

function TeamRow({
  side,
  pens,
  isWinner,
  decided,
  code,
}: {
  side: MatchDetail["home"];
  pens: number | null;
  isWinner: boolean;
  decided: boolean;
  code: string;
}) {
  const dimmed = decided && !isWinner;
  return (
    <div className={`flex items-center gap-3 py-2 ${dimmed ? "text-ink-4" : "text-ink"}`}>
      <TeamLink poolCode={code} code={side.code}>
        <Flag code={side.code} size={28} />
      </TeamLink>
      <TeamLink poolCode={code} code={side.code} className={`flex-1 truncate text-lg underline-offset-2 hover:underline ${isWinner ? "font-bold" : "font-semibold"}`}>
        {side.name}
        {side.code ? <span className="ml-2 font-mono text-xs text-ink-3">{side.code}</span> : null}
      </TeamLink>
      {pens != null ? (
        <span className="font-mono text-xs font-semibold tabular-nums text-ink-3">({pens} pens)</span>
      ) : null}
      {side.score !== null ? (
        <span className="font-display text-2xl tabular-nums">{side.score}</span>
      ) : null}
    </div>
  );
}

const SLICE_COLOR: Record<string, string> = {
  home: "var(--pitch)",
  away: "var(--round-r16)",
  other: "var(--ink-4)",
};

function SplitRow({ slice, kind }: { slice: PickSplitSlice; kind: keyof typeof SLICE_COLOR }) {
  if (slice.count === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{slice.name}</span>
        <span className="font-mono tabular-nums text-ink-3">
          {slice.count} · {slice.pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-sunk">
        <div
          className="h-full rounded-full"
          style={{ width: `${slice.pct}%`, background: SLICE_COLOR[kind] }}
        />
      </div>
    </div>
  );
}

function PickSplitCard({ split }: { split: PickSplit }) {
  if (split.total === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Pool pick-split</p>
        <p className="mt-2 text-sm text-ink-3">No winner picks recorded for this match yet.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Pool pick-split · {split.total} {split.total === 1 ? "entry" : "entries"}
      </p>
      <div className="mt-3 space-y-3">
        <SplitRow slice={split.home} kind="home" />
        <SplitRow slice={split.away} kind="away" />
        <SplitRow slice={split.other} kind="other" />
      </div>
    </div>
  );
}

function formatPrice(amount: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

// Official "buy tickets" link with the lowest known price. Only shown once the
// poller has a Ticketmaster link for this match; hidden entirely otherwise.
function TicketLine({ tickets }: { tickets: MatchDetail["tickets"] }) {
  if (!tickets?.url) return null;
  const label =
    tickets.minPrice != null && tickets.minPrice > 0
      ? `From ${formatPrice(tickets.minPrice, tickets.currency)}`
      : "Tickets";
  return (
    <a
      href={tickets.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-pitch underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
    >
      <span aria-hidden>🎟️</span>
      {label} · Buy tickets
      <span aria-hidden>↗</span>
    </a>
  );
}

// Over/Under total-goals market, shown under the win-probability bar once the
// totals line has been polled. Hidden entirely otherwise.
function TotalsLine({ totals }: { totals: MatchDetail["totals"] }) {
  if (!totals) return null;
  const over = Math.round(totals.overProb * 100);
  const under = Math.round(totals.underProb * 100);
  return (
    <p className="mt-2 text-xs text-ink-3">
      <span className="font-semibold text-ink-2">O/U {totals.line}</span>
      {" — Over "}
      {over}% · Under {under}%
    </p>
  );
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ code: string; no: string }>;
}) {
  const { code, no } = await params;
  const matchNo = Number(no);
  if (!Number.isInteger(matchNo)) notFound();

  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const access = await getPoolAccess(pool.id);
  const sessionUser = access?.user ?? (await getSessionUser());
  const isMember = Boolean(access);

  const [detail, initialMessages] = await Promise.all([
    getMatchDetail(pool.id, matchNo, sessionUser?.id ?? null),
    listMessages(pool.id, 50, sessionUser?.id ?? null),
  ]);

  if (!detail) notFound();

  const decided = detail.status === "FINAL" && Boolean(detail.winnerCode);
  const teamsKnown = Boolean(detail.home.code && detail.away.code);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          {detail.roundLabel}
        </h2>
        <Link
          href={`/pool/${code}/matches`}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
        >
          ← All matches
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {detail.status === "LIVE" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
                {detail.elapsed != null ? `${detail.elapsed}'` : "Live"}
              </span>
            ) : detail.status === "FINAL" ? (
              <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
                Final
              </span>
            ) : (
              <span className="font-mono text-xs text-ink-3">
                {detail.scheduledAt ? formatKickoff(detail.scheduledAt) : "Kickoff time TBD"}
              </span>
            )}
            <UpsetBadge status={detail.status} homeScore={detail.home.score} awayScore={detail.away.score} odds={detail.odds} />
          </div>
          {detail.yourPick ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-white"
              style={{
                background:
                  detail.yourPick.correct === true
                    ? "var(--positive)"
                    : detail.yourPick.correct === false
                      ? "var(--negative)"
                      : "var(--ink-3)",
              }}
            >
              {detail.yourPick.correct === true ? "✓ " : detail.yourPick.correct === false ? "✗ " : ""}
              You picked {detail.yourPick.name}
            </span>
          ) : null}
        </div>
        <TeamRow side={detail.home} pens={detail.homePens} isWinner={decided && detail.winnerCode === detail.home.code} decided={decided} code={code} />
        <TeamScorers timeline={detail.timeline} side="home" />
        <div className="h-px bg-line-soft" />
        <TeamRow side={detail.away} pens={detail.awayPens} isWinner={decided && detail.winnerCode === detail.away.code} decided={decided} code={code} />
        <TeamScorers timeline={detail.timeline} side="away" />
        <div className="mt-3">
          <VenueLine venue={detail.venue} city={detail.city} cityToken={detail.cityToken} code={code} />
          <TicketLine tickets={detail.tickets} />
        </div>
        <WinProbBar odds={detail.odds} homeCode={detail.home.code} awayCode={detail.away.code} fetchedAt={detail.oddsFetchedAt} />
        <TotalsLine totals={detail.totals} />
        {detail.scored && detail.yourPick && detail.odds ? (() => {
          const code = detail.yourPick.code;
          const p = code === detail.home.code ? detail.odds.homeWinProb
                  : code === detail.away.code ? detail.odds.awayWinProb : null;
          return p != null ? (
            <p className="mt-1 text-xs text-ink-3">You backed a {Math.round(p * 100)}% pick</p>
          ) : null;
        })() : null}
      </div>

      <MatchInsights prediction={detail.prediction} home={detail.home} away={detail.away} />
      <MatchInjuries injuries={detail.injuries} home={detail.home} away={detail.away} />
      <MatchLineups lineup={detail.lineup} home={detail.home} away={detail.away} />
      <MatchTimeline items={detail.timeline} />
      <MatchStatsBars bars={detail.stats} homeCode={detail.home.code} awayCode={detail.away.code} />

      {detail.scored && detail.pickSplit ? <PickSplitCard split={detail.pickSplit} /> : null}

      {detail.scored && teamsKnown ? (
        isMember ? (
          <WhatIf
            poolId={pool.id}
            matchNo={detail.matchNo}
            homeCode={detail.home.code!}
            awayCode={detail.away.code!}
            homeName={detail.home.name}
            awayName={detail.away.name}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-4 text-center text-sm text-ink-3">
            <Link
              href="/signin"
              className="font-semibold text-pitch underline-offset-2 hover:underline"
            >
              Sign in
            </Link>{" "}
            to see how this result would swing the standings.
          </div>
        )
      ) : null}

      {/* The pool chat only belongs on a match page while the game is live — the
          in-the-moment reactions. Off-match, it lives on the dedicated chat tab. */}
      {detail.status === "LIVE" ? (
        <div>
          <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Pool chat</h3>
          <Chat poolId={pool.id} currentUserId={sessionUser?.id ?? ""} initialMessages={initialMessages} />
        </div>
      ) : null}
    </section>
  );
}
