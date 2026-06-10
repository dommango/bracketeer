import Link from "next/link";
import { formatKickoff } from "@/lib/pool/format";
import { CountUp } from "./CountUp";
import { Countdown } from "./Countdown";
import type {
  HomeView,
  HomeLeader,
  HomeMover,
  HomeNextMatch,
  HomeChatTeaser,
  Standing,
} from "@/lib/pool/home";

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

function truncate(text: string, max = 80): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

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

function MoverCard({ mover }: { mover: HomeMover }) {
  const climbed = mover.rankDelta > 0;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className={LABEL}>Today’s biggest mover</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{mover.label}</span>
        <span className="rounded-full bg-pitch-tint px-2 py-0.5 text-[11px] font-bold tabular-nums text-pitch-dark">
          +{mover.pointsGained} pts
        </span>
        {mover.rankDelta !== 0 ? (
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: climbed ? "var(--positive)" : "var(--negative)" }}
          >
            {climbed ? "▲" : "▼"} {Math.abs(mover.rankDelta)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function NextMatchCard({ next }: { next: HomeNextMatch }) {
  const teams = next.home && next.away ? `${next.home} v ${next.away}` : `Match ${next.matchNo}`;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className={LABEL}>Up next</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">{teams}</span>
        <span className="font-mono text-[11px] text-ink-3">
          {ROUND_LABEL[next.roundCode] ?? next.roundCode}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-3">
        {next.scheduledAt ? formatKickoff(next.scheduledAt) : "Kickoff time TBD"}
      </p>
    </div>
  );
}

function ChatTeaserCard({ teaser, code }: { teaser: HomeChatTeaser; code: string }) {
  return (
    <Link
      href={`/pool/${code}/chat`}
      className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
    >
      <p className={LABEL}>Latest in chat</p>
      <p className="mt-2 text-sm text-ink">
        <span className="font-semibold text-pitch-dark">{teaser.authorName}</span>{" "}
        {truncate(teaser.body)}
      </p>
    </Link>
  );
}

export function Home({
  view,
  code,
  signedIn,
  startsAt,
  upcoming,
}: {
  view: HomeView;
  code: string;
  signedIn: boolean;
  startsAt: string;
  upcoming: boolean;
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
      {view.topMover ? <MoverCard mover={view.topMover} /> : null}
      {view.nextMatch ? <NextMatchCard next={view.nextMatch} /> : null}
      {view.chatTeaser ? <ChatTeaserCard teaser={view.chatTeaser} code={code} /> : null}
    </div>
  );
}
