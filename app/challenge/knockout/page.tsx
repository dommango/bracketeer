import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getKnockoutChallengeHome } from "@/lib/challenge/knockout-dashboard";
import { ScoreCards } from "@/app/pool/[code]/ScoreCards";
import { Leaderboard } from "@/app/pool/[code]/Leaderboard";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { ChallengeStanding } from "../ChallengeStanding";

// Picks, locks, and live results change at request time.
export const dynamic = "force-dynamic";

export default async function KnockoutChallengeHomePage() {
  const user = await getSessionUser();
  const { standing, board, cards, myBrackets, open, earlyOpen, opensAt } =
    await getKnockoutChallengeHome(user?.id ?? null);

  const buildable = open || earlyOpen;
  const hasBracket = myBrackets.length > 0;
  const entered = myBrackets.some((b) => b.enteredChallenge);

  const top = board.slice(0, 5);
  const mine = user?.id ? board.find((r) => r.userId === user.id) : null;
  const preview = mine && !top.some((r) => r.entryId === mine.entryId) ? [...top, mine] : top;

  return (
    <section className="space-y-5">
      <ChallengeStanding
        standing={standing}
        boardHref="/challenge/knockout/leaderboard"
        cta={{ href: "/bracket", label: hasBracket ? "Finish your bracket" : "Build your bracket" }}
      />

      {!buildable ? (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
          <p className="text-sm font-semibold text-ink-2">Picks open at the draw</p>
          <p className="mt-1 text-sm text-ink-3">
            Once the last 32 are confirmed, build your bracket and enter the challenge.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
            <span className="text-sm font-semibold text-pitch-dark">Picks open in</span>
            <Countdown target={opensAt.toISOString()} className="text-sm font-mono text-pitch-dark" />
          </div>
        </div>
      ) : (
        <Link
          href="/bracket"
          className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)] transition-colors hover:bg-surface-sunk"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              {hasBracket ? "Your bracket" : "Build your bracket"}
            </span>
            <span className="mt-0.5 block text-[13px] text-ink-3">
              {hasBracket
                ? entered
                  ? "On the global leaderboard — edit until the Round of 32 kicks off."
                  : "Enter it into the challenge to climb the global leaderboard."
                : "Pick every knockout winner from the Round of 32 to the final."}
            </span>
          </span>
          <span className="shrink-0 font-display text-pitch-dark">→</span>
        </Link>
      )}

      <Link
        href="/challenge/knockout/scoring"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)] transition-colors hover:bg-surface-sunk"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">How scoring works</span>
          <span className="mt-0.5 block text-[13px] text-ink-3">
            Per-round points (no awards), plus the final-goals tiebreaker.
          </span>
        </span>
        <span className="shrink-0 font-display text-pitch-dark">→</span>
      </Link>

      <ScoreCards
        live={cards.live}
        last={cards.last}
        next={cards.next}
        hrefForMatch={(no) =>
          no >= 73 ? `/challenge/knockout/matches/${no}` : "/challenge/knockout/matches"
        }
      />

      {preview.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Leaderboard</h2>
            <Link
              href="/challenge/knockout/leaderboard"
              className="text-xs font-semibold text-pitch hover:underline"
            >
              See all →
            </Link>
          </div>
          <Leaderboard rows={preview} youUserId={user?.id} linkBase="/challenge/knockout/u" compact />
        </div>
      ) : null}
    </section>
  );
}
