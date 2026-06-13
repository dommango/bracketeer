import Link from "next/link";
import { formatKickoff } from "@/lib/pool/format";
import { CountUp } from "./CountUp";
import { Countdown } from "./Countdown";
import { Leaderboard } from "./Leaderboard";
import { CopyButton } from "./manage/CopyButton";
import type { HomeView, HomeLeader, HomeMover, HomeNextMatch, Standing } from "@/lib/pool/home";
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

function StandingCard({
  you,
  leader,
  signedIn,
}: {
  you: Standing | null;
  leader: HomeLeader | null;
  signedIn: boolean;
}) {
  if (!you) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
        <p className="text-sm text-ink-3">
          {signedIn
            ? "Your account isn’t linked to an entry yet. Sign in with the email your bracket was imported under."
            : "Sign in to see your standing and claim your bracket."}
        </p>
        {!signedIn ? (
          <Link
            href="/signin"
            className="mt-3 inline-block font-semibold text-pitch underline-offset-2 hover:underline"
          >
            Sign in →
          </Link>
        ) : null}
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
    </div>
  );
}

// Next match + today's mover folded into one compact card — context without the
// stacked-card clutter the old digest had. Renders only the rows that exist.
function ContextStrip({ next, mover }: { next: HomeNextMatch | null; mover: HomeMover | null }) {
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
        <div className="flex items-center gap-2 px-4 py-3">
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

// Join-code lives here now (relocated off the every-screen hero) so members can
// still invite from the landing; admins also have the full invite UI on Manage.
function InviteLine({ joinCode }: { joinCode: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">Invite</p>
        <p className="font-mono text-lg font-bold tracking-[0.1em] tabular-nums text-ink">
          {joinCode}
        </p>
      </div>
      <div className="ml-auto">
        <CopyButton value={joinCode} label="Copy code" />
      </div>
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
  joinCode,
  entryCount,
}: {
  view: HomeView;
  leaderboard: LeaderboardRow[];
  youUserId?: string | null;
  code: string;
  signedIn: boolean;
  startsAt: string;
  upcoming: boolean;
  joinCode: string;
  entryCount: number;
}) {
  return (
    <div className="space-y-4">
      <StandingCard you={view.you} leader={view.leader} signedIn={signedIn} />

      {signedIn ? (
        <Link
          href={`/pool/${code}/picks`}
          className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
        >
          <div>
            <p className={LABEL}>Your bracket</p>
            <p className="mt-1 font-semibold text-ink">
              {view.you ? "Review or edit your picks" : "Make your picks"}
            </p>
            {upcoming ? (
              <p className="mt-1 text-xs text-ink-3">
                Locks in{" "}
                <Countdown target={startsAt} showSeconds={false} className="text-xs text-ink-2" />
              </p>
            ) : null}
          </div>
          <span className="font-display text-pitch-dark">→</span>
        </Link>
      ) : null}

      <ContextStrip next={view.nextMatch} mover={view.topMover} />

      <InviteLine joinCode={joinCode} />

      <section>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            Leaderboard
            <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
              {entryCount} {entryCount === 1 ? "entry" : "entries"}
            </span>
          </h2>
          {leaderboard.length >= 2 ? (
            <Link
              href={`/pool/${code}/compare`}
              className="text-xs font-semibold text-pitch hover:underline"
            >
              Compare brackets →
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
