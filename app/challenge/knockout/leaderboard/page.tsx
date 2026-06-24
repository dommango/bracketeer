import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { getKnockoutState, getTournamentIdBySlug } from "@/lib/pool/queries";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { Leaderboard } from "@/app/pool/[code]/Leaderboard";

export const dynamic = "force-dynamic";

export default async function KnockoutChallengeLeaderboardPage() {
  const [rows, user, tournamentId] = await Promise.all([
    getChallengeLeaderboard(),
    getSessionUser(),
    getTournamentIdBySlug(),
  ]);
  const { locksAt } = await getKnockoutState(tournamentId);
  const locked = isKnockoutLocked(locksAt);

  return (
    <section className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl text-ink">Leaderboard</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Every bracket entered into the global Knockout Challenge, ranked together.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink-2">No entries yet</p>
          <p className="mt-1.5 text-sm text-ink-3">Be the first to enter the tournament.</p>
          <Link
            href="/bracket"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
          >
            Build your bracket →
          </Link>
        </div>
      ) : (
        <Leaderboard
          rows={rows}
          youUserId={user?.id}
          linkBase="/challenge/knockout/u"
          showMedals={locked}
        />
      )}
    </section>
  );
}
