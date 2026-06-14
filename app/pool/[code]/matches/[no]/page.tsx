import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getMatchDetail, type MatchDetail } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { listMessages } from "@/lib/pool/chat";
import type { PickSplit, PickSplitSlice } from "@/lib/pool/pick-split";
import { formatKickoff } from "@/lib/pool/format";
import { Flag } from "../../Flag";
import { WhatIf } from "../../WhatIf";
import { Chat } from "../../Chat";
import { MatchTimeline, MatchStatsBars } from "./MatchLive";
import { VenueLine } from "../../VenueLine";

export const dynamic = "force-dynamic";

function TeamRow({
  side,
  pens,
  isWinner,
  decided,
}: {
  side: MatchDetail["home"];
  pens: number | null;
  isWinner: boolean;
  decided: boolean;
}) {
  const dimmed = decided && !isWinner;
  return (
    <div className={`flex items-center gap-3 py-2 ${dimmed ? "text-ink-4" : "text-ink"}`}>
      <Flag code={side.code} size={28} />
      <span className={`flex-1 truncate text-lg ${isWinner ? "font-bold" : "font-semibold"}`}>
        {side.name}
        {side.code ? <span className="ml-2 font-mono text-xs text-ink-3">{side.code}</span> : null}
      </span>
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
        <TeamRow side={detail.home} pens={detail.homePens} isWinner={decided && detail.winnerCode === detail.home.code} decided={decided} />
        <div className="h-px bg-line-soft" />
        <TeamRow side={detail.away} pens={detail.awayPens} isWinner={decided && detail.winnerCode === detail.away.code} decided={decided} />
        <div className="mt-3">
          <VenueLine venue={detail.venue} city={detail.city} />
        </div>
      </div>

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

      <div>
        <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Pool chat</h3>
        <Chat poolId={pool.id} currentUserId={sessionUser?.id ?? ""} initialMessages={initialMessages} />
      </div>
    </section>
  );
}
