import Link from "next/link";
import { formatKickoff } from "@/lib/pool/format";
import { CountUp } from "./CountUp";
import { Countdown } from "./Countdown";
import { Leaderboard } from "./Leaderboard";
import { LiveNow } from "./LiveNow";
import type { HomeView, HomeLeader, HomeNextMatch, HomeStats, Standing } from "@/lib/pool/home";
import type { LeaderboardRow } from "@/lib/pool/scoring";

const ROUND_LABEL: Record<string, string> = {
  GROUP: "Group stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  BRONZE: "Third place",
  FINAL: "Final",
};

const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// A minor inline link to the pick editor, folded into the standing card so the
// bracket no longer needs its own card. Shows the lock countdown pre-tournament.
function PicksLink({
  code,
  hasEntry,
  upcoming,
  startsAt,
}: {
  code: string;
  hasEntry: boolean;
  upcoming: boolean;
  startsAt: string;
}) {
  return (
    <Link
      href={`/pool/${code}/picks`}
      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-pitch hover:underline"
    >
      {hasEntry ? "Review or edit your picks" : "Make your picks"}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
      {upcoming ? (
        <span className="ml-1 text-xs font-normal text-ink-3">
          · locks in{" "}
          <Countdown target={startsAt} showSeconds={false} className="text-xs text-ink-2" />
        </span>
      ) : null}
    </Link>
  );
}

function StandingCard({
  you,
  leader,
  signedIn,
  code,
  upcoming,
  startsAt,
}: {
  you: Standing | null;
  leader: HomeLeader | null;
  signedIn: boolean;
  code: string;
  upcoming: boolean;
  startsAt: string;
}) {
  if (!you) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
        <p className="text-sm text-ink-3">
          {signedIn
            ? "Your account isn’t linked to an entry yet. Sign in with the email your bracket was imported under."
            : "Sign in to see your standing and claim your bracket."}
        </p>
        <div className="mt-3">
          {signedIn ? (
            <PicksLink code={code} hasEntry={false} upcoming={upcoming} startsAt={startsAt} />
          ) : (
            <Link
              href="/signin"
              className="inline-block font-semibold text-pitch underline-offset-2 hover:underline"
            >
              Sign in →
            </Link>
          )}
        </div>
      </div>
    );
  }

  const isLeader = you.rank === 1;
  return (
    <div
      className={`rounded-2xl border bg-surface p-5 ${
        isLeader ? "border-gold shadow-[var(--shadow-ring-gold)]" : "border-line shadow-[var(--shadow-xs)]"
      }`}
    >
      <p className={LABEL}>Your standing</p>
      <div className="mt-2 flex items-end gap-4">
        <div className="leading-none">
          <span className="font-display text-[44px] text-ink">#{you.rank}</span>
          <span className="ml-1.5 text-sm text-ink-3">of {you.entryCount}</span>
        </div>
        <div className="ml-auto text-right leading-none">
          <CountUp value={you.total} className="font-display text-[32px] tabular-nums text-ink" />
          <span className="text-xs text-ink-3"> pts</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-2">
        {isLeader ? (
          "You’re leading the pool 🏆"
        ) : (
          <>
            <span className="font-mono tabular-nums text-ink">{you.gapToNext}</span> pts to the spot
            above
            {leader ? (
              <>
                {" · "}
                <span className="font-mono tabular-nums text-ink">{you.gapToLeader}</span> behind{" "}
                {leader.label}
              </>
            ) : null}
          </>
        )}
      </p>
      <div className="mt-4 border-t border-line-soft pt-3">
        <PicksLink code={code} hasEntry upcoming={upcoming} startsAt={startsAt} />
      </div>
    </div>
  );
}

// Your other brackets in this pool, when you hold more than one — compact rows
// that link to each entry's profile.
function OtherEntries({ entries, code }: { entries: Standing[]; code: string }) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h2 className={`px-1 ${LABEL}`}>Your other brackets</h2>
      <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
        {entries.map((e) => (
          <li key={e.entryId}>
            <Link
              href={`/pool/${code}/u/${e.entryId}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-sunk"
            >
              <span className="w-8 shrink-0 text-center font-display text-lg text-ink-3">
                #{e.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{e.label}</span>
              <span className="shrink-0 text-right">
                <span className="font-display text-lg tabular-nums text-ink">{e.total}</span>
                <span className="text-xs text-ink-3"> pts</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Your headline numbers — accuracy and your boldest correct call. Shown once
// matches are decided (the data layer returns null pre-tournament).
function StatsStrip({ stats }: { stats: HomeStats }) {
  const { accuracy, boldest } = stats;
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Accuracy</span>
        <span className="ml-1 font-semibold text-ink">
          <span className="font-mono tabular-nums">
            {accuracy.hits}/{accuracy.decided}
          </span>{" "}
          calls
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-pitch-tint px-2 py-0.5 text-[11px] font-bold tabular-nums text-pitch-dark">
          {accuracy.pct}%
        </span>
      </div>
      {boldest ? (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Boldest</span>
          <span className="ml-1 truncate font-semibold text-ink">{boldest.pickName}</span>
          <span className="shrink-0 text-xs text-ink-3">{boldest.roundLabel}</span>
          <span className="ml-auto shrink-0 text-xs text-ink-3">
            <span className="font-mono tabular-nums">{boldest.sharePct}%</span> of pool
          </span>
        </div>
      ) : null}
    </div>
  );
}

// Next match + today's mover folded into one compact card — context without the
// stacked-card clutter the old digest had. Renders only the rows that exist.
function ContextStrip({
  next,
  mover,
}: {
  next: HomeNextMatch | null;
  mover: HomeView["topMover"];
}) {
  if (!next && !mover) return null;
  const teams = next
    ? next.home && next.away
      ? `${next.home} v ${next.away}`
      : `Match ${next.matchNo}`
    : null;
  const climbed = mover ? mover.rankDelta > 0 : false;
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {next ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <span aria-hidden className="text-ink-3">
            ⚽
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Up next</span>
          <span className="ml-1 truncate font-semibold text-ink">{teams}</span>
          <span className="ml-auto shrink-0 text-xs text-ink-3">
            {next.scheduledAt
              ? formatKickoff(next.scheduledAt)
              : (ROUND_LABEL[next.roundCode] ?? next.roundCode)}
          </span>
          {next.yourPick ? (
            <span className="w-full pl-6">
              <span className="inline-flex items-center rounded-full bg-pitch-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-pitch-dark">
                Your pick: {next.yourPick.name}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      {mover ? (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Top mover</span>
          <span className="ml-1 truncate font-semibold text-ink">{mover.label}</span>
          {mover.rankDelta !== 0 ? (
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: climbed ? "var(--positive)" : "var(--negative)" }}
              aria-label={`moved ${climbed ? "up" : "down"} ${Math.abs(mover.rankDelta)}`}
            >
              <span aria-hidden>
                {climbed ? "▲" : "▼"} {Math.abs(mover.rankDelta)}
              </span>
            </span>
          ) : null}
          <span className="ml-auto shrink-0 rounded-full bg-pitch-tint px-2 py-0.5 text-[11px] font-bold tabular-nums text-pitch-dark">
            +{mover.pointsGained} pts
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function Home({
  view,
  leaderboard,
  youUserId,
  code,
  signedIn,
  startsAt,
  upcoming,
  entryCount,
  hasMore,
}: {
  view: HomeView;
  // Already truncated to the top rows (+ your row when you're below it).
  leaderboard: LeaderboardRow[];
  youUserId?: string | null;
  code: string;
  signedIn: boolean;
  startsAt: string;
  upcoming: boolean;
  entryCount: number;
  // True when the pool has more entries than the truncated top rows shown here.
  hasMore: boolean;
}) {
  return (
    <div className="space-y-4">
      <LiveNow rows={view.liveMatches} code={code} />

      <StandingCard
        you={view.you}
        leader={view.leader}
        signedIn={signedIn}
        code={code}
        upcoming={upcoming}
        startsAt={startsAt}
      />

      <OtherEntries entries={view.otherEntries} code={code} />

      {view.stats ? <StatsStrip stats={view.stats} /> : null}

      <ContextStrip next={view.nextMatch} mover={view.topMover} />

      <section>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            Leaderboard
            <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
              {entryCount} {entryCount === 1 ? "entry" : "entries"}
            </span>
          </h2>
          {hasMore ? (
            <Link
              href={`/pool/${code}/leaderboard`}
              className="text-xs font-semibold text-pitch hover:underline"
            >
              Full leaderboard →
            </Link>
          ) : null}
        </div>
        <div className="mt-2.5">
          <Leaderboard rows={leaderboard} youUserId={youUserId} code={code} />
        </div>
      </section>
    </div>
  );
}
