import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { isMd3Participant } from "@/lib/challenge/md3-entry";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
import { Leaderboard } from "@/app/pool/[code]/Leaderboard";

export const dynamic = "force-dynamic";

export default async function Md3ChallengeLeaderboardPage() {
  const user = await getSessionUser();
  // Participants-only: you need at least one saved prediction to see the board,
  // so a non-player can't scout the field. Don't even load it otherwise.
  const participant = await isMd3Participant(user?.id ?? null);
  const rows = participant ? await getMd3ChallengeLeaderboard() : [];

  return (
    <section className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl text-ink">Leaderboard</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Every Match Day Pickem entry, ranked together.
        </p>
      </header>

      {!participant ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink-2">Make a pick to see the leaderboard</p>
          <p className="mx-auto mt-1.5 max-w-[34ch] text-sm text-ink-3">
            The leaderboard is for players only. Predict at least one fixture to take your place and
            see how you stack up.
          </p>
          <Link
            href="/challenge/md3/play"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.98]"
          >
            Make your picks →
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          No entries yet — you&apos;re first on the leaderboard.
        </p>
      ) : (
        <>
          <Leaderboard
            rows={rows}
            youUserId={user?.id}
            linkBase="/challenge/md3/u"
            showMedals={!isMd3GameOpen()}
            showLiveNote={false}
          />
          {/* Tiebreak order — mirrors the quality cascade in
              lib/challenge/md3-tiebreak.ts and the /rules copy. */}
          <p className="rounded-2xl border border-line bg-surface-sunk/40 px-4 py-3 text-[13px] leading-relaxed text-ink-3">
            <span className="font-semibold text-ink">Tied on points?</span> Whoever nailed more
            exact scorelines ranks first — then more right result &amp; goal difference, then more
            correct results, then whoever&apos;s total goals land closest to the real total.
          </p>
        </>
      )}
    </section>
  );
}
