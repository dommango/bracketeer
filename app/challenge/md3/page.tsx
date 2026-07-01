import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getDailyKnockoutHome } from "@/lib/challenge/daily-knockout-dashboard";
import { ScoreCards } from "@/app/pool/[code]/ScoreCards";
import { Leaderboard } from "@/app/pool/[code]/Leaderboard";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { ChallengeStanding } from "../ChallengeStanding";
import { md3CountLine } from "@/lib/pool/md3-summary";
import { GameSwitcher } from "@/app/challenge/GameSwitcher";
import { ChallengeRecentChat } from "@/app/challenge/ChallengeRecentChat";
import type { BoardBucket } from "@/lib/challenge/daily-knockout-boards";
import type { KnockoutChampions } from "@/lib/challenge/leaderboard";

// Predictions, locks, and live results change at request time.
export const dynamic = "force-dynamic";

// Compact per-round sub-board row: label + round multiplier, the viewer's pick/
// scored progress, weighted points, and a 👑 when the viewer tops that round. The
// knockout game is a round-weighted ladder, so this is the hub's hero content.
function RoundBoards({
  rounds,
  championEntryByRound,
}: {
  rounds: BoardBucket[];
  championEntryByRound: Map<string, string>; // round key → "you" when the viewer leads it
}) {
  if (rounds.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        By round · weighted ladder
      </h2>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-xs)]">
        {rounds.map((r) => (
          <li
            key={r.key}
            className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
          >
            <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              {r.label}
              <span className="rounded bg-surface-sunk px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink-3">
                ×{r.weight}
              </span>
              {championEntryByRound.get(r.key) === "you" ? <span title="Round champion">👑</span> : null}
            </span>
            <span className="flex items-center gap-3 text-[13px] text-ink-3">
              <span>
                {r.pickedCount > 0 ? `${r.pickedCount} picked` : `${r.fixtures.length} fixtures`}
              </span>
              {r.scoredCount > 0 ? (
                <span className="rounded-full bg-pitch-tint px-2 py-0.5 text-[12px] font-bold text-pitch-dark">
                  {r.points} pts
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A strip of the crowns the viewer has earned — round champion, day winner, perfect
// days — the daily/round "ritual" rewards. Renders nothing when they've won none.
function YourCrowns({
  champions,
  byDay,
  myEntryId,
}: {
  champions: KnockoutChampions;
  byDay: BoardBucket[];
  myEntryId: string | null;
}) {
  if (!myEntryId) return null;
  const roundWins = Object.values(champions.byRound).filter((c) => c?.entryId === myEntryId).length;
  const dayWins = champions.byDay.filter((c) => c.entryId === myEntryId).length;
  const perfectDays = byDay.filter((d) => d.perfectDay).length;
  if (roundWins === 0 && dayWins === 0 && perfectDays === 0) return null;

  const chips: string[] = [];
  if (roundWins > 0) chips.push(`👑 ${roundWins} round${roundWins > 1 ? "s" : ""} won`);
  if (dayWins > 0) chips.push(`🏆 ${dayWins} day${dayWins > 1 ? "s" : ""} won`);
  if (perfectDays > 0) chips.push(`✨ ${perfectDays} perfect day${perfectDays > 1 ? "s" : ""}`);

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full border border-gold/40 bg-gold-tint px-3 py-1 text-[13px] font-semibold text-gold-dark"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export default async function DailyKnockoutHomePage() {
  const user = await getSessionUser();
  const { standing, board, view, cards, byRound, byDay, champions } = await getDailyKnockoutHome(
    user?.id ?? null,
  );

  // The viewer's own entry on the board (if any), used to light up 👑 crowns.
  const myEntryId = user?.id ? (board.find((r) => r.userId === user.id)?.entryId ?? null) : null;
  const championEntryByRound = new Map<string, string>();
  for (const [stage, champ] of Object.entries(champions.byRound)) {
    if (champ && myEntryId && champ.entryId === myEntryId) championEntryByRound.set(stage, "you");
  }

  // The soonest still-open, seated fixture's kickoff is the next lock; null once
  // every open fixture has kicked off.
  const nextLock = view.fixtures
    .filter((f) => f.open && !f.locked)
    .map((f) => f.kickoffISO)
    .filter((iso): iso is string => iso != null)
    .sort()[0];

  // The board is participants-only — you must have made at least one prediction
  // to see where you (and everyone else) stand.
  const isParticipant = view.pickedCount > 0;

  const top = board.slice(0, 5);
  const mine = user?.id ? board.find((r) => r.userId === user.id) : null;
  const preview = mine && !top.some((r) => r.entryId === mine.entryId) ? [...top, mine] : top;

  return (
    <section className="space-y-5">
      <ChallengeRecentChat />

      <ScoreCards
        live={cards.live}
        last={cards.last}
        next={cards.next}
        hrefForMatch={(no) => `/challenge/md3/matches/${no}`}
      />

      <GameSwitcher now={new Date()} />

      <ChallengeStanding
        standing={standing}
        boardHref="/challenge/md3/leaderboard"
        cta={{ href: "/challenge/md3/play", label: "Make your picks" }}
      />

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{md3CountLine(view)}</p>
            {nextLock ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-3">
                Next lock in{" "}
                <Countdown target={nextLock} className="font-mono font-semibold text-pitch-dark" />
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-ink-3">No fixtures open right now.</p>
            )}
          </div>
          {view.openCount > 0 ? (
            <Link
              href="/challenge/md3/play"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-pitch px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.98]"
            >
              {view.pickedCount > 0 ? "Edit picks" : "Play"}
            </Link>
          ) : null}
        </div>
      </div>

      <Link
        href="/challenge/md3/scoring"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)] transition-colors hover:bg-surface-sunk"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">How scoring works</span>
          <span className="mt-0.5 block text-[13px] text-ink-3">
            Scoreline points, the round-weighted ladder, and the day crowns.
          </span>
        </span>
        <span className="shrink-0 font-display text-pitch-dark">→</span>
      </Link>

      <YourCrowns champions={champions} byDay={byDay} myEntryId={myEntryId} />

      <RoundBoards rounds={byRound} championEntryByRound={championEntryByRound} />

      {isParticipant && preview.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Leaderboard</h2>
            <Link
              href="/challenge/md3/leaderboard"
              className="text-xs font-semibold text-pitch hover:underline"
            >
              See all →
            </Link>
          </div>
          <Leaderboard
            rows={preview}
            youUserId={user?.id}
            linkBase="/challenge/md3/u"
            compact
            showMedals={view.openCount === 0}
          />
        </div>
      ) : null}
    </section>
  );
}
