import Link from "next/link";
import { CountUp } from "./CountUp";
import { Countdown } from "./Countdown";
import { Leaderboard } from "./Leaderboard";
import { ScoreCards } from "./ScoreCards";
import { GroupStandings } from "./Bracket";
import { GroupOverlay } from "./GroupOverlay";
import type { HomeView, HomeLeader, HomeStats, Standing } from "@/lib/pool/home";
import type { LeaderboardRow } from "@/lib/pool/scoring";
import type { BracketView } from "@/lib/pool/bracket-view";
import type { BracketOverlay } from "@/lib/pool/queries";
import type { ChatView } from "@/lib/pool/chat";
import type { PoolFormat } from "@/lib/pool/manage";
import { prizeTeaser, GAME_CATALOG } from "@/lib/pool/games";
import { DISPLAY_TZ } from "@/lib/tz";

const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// Short time-of-day in the pool's display zone (Eastern), matching Chat.tsx's
// timeLabel so timestamps read identically across the app — not the viewer's zone.
function chatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

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
      {hasEntry ? (upcoming ? "Review or edit your picks" : "Review your picks") : "Make your picks"}
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
      className={`rounded-2xl border bg-surface p-4 ${
        isLeader ? "border-gold shadow-[var(--shadow-ring-gold)]" : "border-line shadow-[var(--shadow-xs)]"
      }`}
    >
      <p className={LABEL}>Your standing</p>
      <div className="mt-1.5 flex items-end gap-4">
        <div className="leading-none">
          <span className="font-display text-[28px] text-ink">#{you.rank}</span>
          <span className="ml-1.5 text-sm text-ink-3">of {you.entryCount}</span>
        </div>
        <div className="ml-auto text-right leading-none">
          <CountUp value={you.total} className="font-display text-[28px] tabular-nums text-ink" />
          <span className="ml-1.5 text-sm text-ink-3">pts</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-2">
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
      <div className="mt-3 border-t border-line-soft pt-2.5">
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

// The latest few chat messages, as a compact card linking to the full chat.
// Members-only; the page passes an empty list to non-members (renders nothing).
function HomeChat({ code, messages }: { code: string; messages: ChatView[] }) {
  if (messages.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between px-1">
        <h2 className={LABEL}>Latest from chat</h2>
        <Link
          href={`/pool/${code}/chat`}
          className="text-xs font-semibold text-pitch hover:underline"
        >
          Open chat →
        </Link>
      </div>
      <ul className="mt-2.5 divide-y divide-line rounded-2xl border border-line bg-surface">
        {/* Newest first in this preview: the list arrives oldest→newest, so show a
            reversed copy with the most recent message on top. */}
        {[...messages].reverse().map((m) => (
          <li key={m.id} className="flex items-baseline gap-2 px-4 py-2.5 text-sm">
            <span className="shrink-0 font-semibold text-ink">
              {m.kind === "SYSTEM" ? "Match update" : (m.authorName ?? "Participant")}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink-2">
              {m.body?.trim()
                ? m.body
                : m.attachmentType === "GIF"
                  ? "Sent a GIF"
                  : m.attachmentType === "IMAGE"
                    ? "Sent a photo"
                    : ""}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-ink-4">{chatTime(m.createdAt)}</span>
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

function ContextStrip({ mover }: { mover: HomeView["topMover"] }) {
  if (!mover) return null;
  const climbed = mover.rankDelta > 0;
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
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
    </div>
  );
}

// Knockout Challenge pools play a different game: picks are made once the last 32
// are known and lock at the Round-of-32 kickoff. Until the group stage resolves
// there's nothing to pick yet, so we surface a clear "picks open at the draw"
// state instead of the full-bracket flow. (The knockout pick editor lands next.)
function KnockoutNotice({
  open,
  opensAt,
  locksAt,
}: {
  // The authoritative "picks can be made" signal — the same one the picks page
  // gates on (KnockoutState.open / isKnockoutFieldSet), so the dashboard and the
  // editor never disagree about whether the bracket is fillable.
  open: boolean;
  // Fixed "picks open" target, shown as a countdown while the field is still closed.
  opensAt: string;
  // R32 kickoff — the lock. Null until the schedule lands; then counted down to.
  locksAt: string | null;
}) {
  return (
    <div className="rounded-2xl border border-pitch/20 bg-pitch/5 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pitch-dark">
        {GAME_CATALOG.KNOCKOUT.challengeName}
      </p>
      {prizeTeaser("KNOCKOUT") ? (
        <p className="mt-1 text-[12px] font-semibold text-gold-dark">🏆 {prizeTeaser("KNOCKOUT")}</p>
      ) : null}
      {open ? (
        <>
          <p className="mt-1.5 text-sm text-ink-2">
            The last 32 are set — knockout picks are open. Fill out your bracket before the
            Round of 32 kickoff.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-pitch-tint px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-pitch-dark">
              Picks lock in
            </span>
            {locksAt ? (
              <Countdown target={locksAt} showSeconds={false} className="text-sm text-pitch-dark" />
            ) : (
              <span className="text-sm text-pitch-dark">at the Round of 32 kickoff</span>
            )}
          </div>
          <Link
            href="/bracket"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-pitch transition-colors hover:text-pitch-dark hover:underline"
          >
            Enter the Challenge →
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-ink-2">
            Picks open at the Round of 32 draw, once the group stage wraps up. Invite your friends
            now with the join code — we’ll notify everyone when the bracket unlocks.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-pitch-tint px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-pitch-dark">
              Picks open in
            </span>
            <Countdown target={opensAt} showSeconds={false} className="text-sm text-pitch-dark" />
          </div>
        </>
      )}
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
  bracket,
  groupOverlay,
  showMedals,
  recentChat,
  format,
  knockoutOpen,
  knockoutOpensAt,
  knockoutLocksAt,
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
  // Live group standings + knockout bracket (null only if the pool has no tournament).
  bracket: BracketView | null;
  // The viewer's brackets with group picks attributed onto the live standings.
  // Null when no overlay applies (signed out, knockout pool, or no bracket owned).
  groupOverlay?: BracketOverlay[] | null;
  // Show leaderboard medals (only after the group stage completes).
  showMedals: boolean;
  // The most recent chat messages (empty for non-members).
  recentChat: ChatView[];
  // The game this pool plays — drives the knockout-only flow.
  format: PoolFormat;
  // Knockout timing for the dashboard countdown (only used when format is KNOCKOUT).
  knockoutOpen?: boolean;
  knockoutOpensAt?: string;
  knockoutLocksAt?: string | null;
}) {
  return (
    <div className="space-y-4">
      {format === "KNOCKOUT" && knockoutOpensAt ? (
        <KnockoutNotice
          open={knockoutOpen ?? false}
          opensAt={knockoutOpensAt}
          locksAt={knockoutLocksAt ?? null}
        />
      ) : null}

      <HomeChat code={code} messages={recentChat} />

      <ScoreCards live={view.liveMatches} last={view.lastMatch} next={view.nextMatch} code={code} />

      <div className="px-1">
        <Link
          href={`/pool/${code}/matches?view=groups&fx=day`}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-pitch hover:underline"
        >
          See all of today’s matches
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>

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

      <ContextStrip mover={view.topMover} />

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
          <Leaderboard rows={leaderboard} youUserId={youUserId} code={code} showMedals={showMedals} compact />
        </div>
      </section>

      {bracket &&
      bracket.groups.some((g) => g.first || g.second || g.table.some((r) => r.played > 0)) ? (
        <section>
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              Group standings
            </h2>
            <Link
              href={`/pool/${code}/matches?view=knockouts`}
              className="text-xs font-semibold text-pitch hover:underline"
            >
              Full bracket →
            </Link>
          </div>
          <div className="mt-2.5">
            {groupOverlay && groupOverlay.length > 0 ? (
              <GroupOverlay view={bracket} brackets={groupOverlay} code={code} />
            ) : (
              <GroupStandings view={bracket} code={code} />
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
