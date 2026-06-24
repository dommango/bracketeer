import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getMd3ChallengeHome } from "@/lib/challenge/md3-dashboard";
import { ScoreCards } from "@/app/pool/[code]/ScoreCards";
import { Leaderboard } from "@/app/pool/[code]/Leaderboard";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { ChallengeStanding } from "../ChallengeStanding";

// Predictions, locks, and live results change at request time.
export const dynamic = "force-dynamic";

export default async function Md3ChallengeHomePage() {
  const user = await getSessionUser();
  const { standing, board, view, cards } = await getMd3ChallengeHome(user?.id ?? null);

  // The soonest still-open fixture's kickoff is the next lock; null once all 24
  // have kicked off (the game is fully locked).
  const nextLock = view.fixtures
    .filter((f) => !f.locked)
    .map((f) => f.kickoffISO)
    .sort()[0];

  // The board is participants-only — you must have made at least one prediction
  // to see where you (and everyone else) stand.
  const isParticipant = view.pickedCount > 0;

  // Top of the board plus the viewer's row when it sits outside the preview.
  const top = board.slice(0, 5);
  const mine = user?.id ? board.find((r) => r.userId === user.id) : null;
  const preview = mine && !top.some((r) => r.entryId === mine.entryId) ? [...top, mine] : top;

  return (
    <section className="space-y-5">
      <ChallengeStanding
        standing={standing}
        boardHref="/challenge/md3/leaderboard"
        cta={{ href: "/challenge/md3/play", label: "Make your picks" }}
      />

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {view.pickedCount}/24 predicted
              {view.openCount > 0 ? (
                <span className="font-normal text-ink-3"> · {view.openCount} still open</span>
              ) : null}
            </p>
            {nextLock ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-3">
                Next lock in{" "}
                <Countdown target={nextLock} className="font-mono font-semibold text-pitch-dark" />
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-ink-3">All fixtures locked — live now.</p>
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

      <ScoreCards
        live={cards.live}
        last={cards.last}
        next={cards.next}
        hrefForMatch={() => "/challenge/md3/matches"}
      />

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
