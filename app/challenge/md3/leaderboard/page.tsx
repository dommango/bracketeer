import { getSessionUser } from "@/lib/pool/access";
import { getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
import { Leaderboard } from "@/app/pool/[code]/Leaderboard";

export const dynamic = "force-dynamic";

export default async function Md3ChallengeLeaderboardPage() {
  const [rows, user] = await Promise.all([getMd3ChallengeLeaderboard(), getSessionUser()]);

  return (
    <section className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl text-ink">Leaderboard</h1>
        <p className="mt-0.5 text-[13px] text-ink-3">
          Every completed Match Day Pickem entry, ranked together.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          No entries yet — predict all 24 fixtures to appear here.
        </p>
      ) : (
        <Leaderboard
          rows={rows}
          youUserId={user?.id}
          linkBase="/challenge/md3/u"
          showMedals={!isMd3GameOpen()}
        />
      )}
    </section>
  );
}
