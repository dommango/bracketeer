import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getDailyKnockoutHome } from "@/lib/challenge/daily-knockout-dashboard";
import { isDailyKnockoutGameOpen } from "@/lib/games/daily-pickem/schedule";
import { roundWeight } from "@/lib/games/daily-pickem/ladder";
import { md3CountLine } from "@/lib/pool/md3-summary";
import { GAME_CATALOG } from "@/lib/pool/games";
import { DailyKnockoutForm } from "../DailyKnockoutForm";

// Predictions, locks, and results change at request time.
export const dynamic = "force-dynamic";

export default async function DailyKnockoutPlayPage() {
  const user = await getSessionUser();
  const { view, standing } = await getDailyKnockoutHome(user?.id ?? null);
  const gameOpen = isDailyKnockoutGameOpen();
  // Weighted ladder total, to match the rank (which is ranked on the ladder).
  const ladderTotal = view.fixtures.reduce(
    (sum, f) => sum + (f.points ?? 0) * roundWeight(f.matchNo),
    0,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="font-display text-lg text-ink">Your picks</h1>
          <p className="text-[13px] text-ink-3">
            {md3CountLine(view)}
            {view.scoredCount > 0 ? ` · ${ladderTotal} pts` : ""}
            {standing ? ` · rank ${standing.rank}` : ""}
          </p>
        </div>
        <Link href="/challenge/md3" className="text-xs font-semibold text-pitch hover:underline">
          Home →
        </Link>
      </div>

      {!user ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
          <Link
            href="/signin?callbackUrl=/challenge/md3/play"
            className="font-semibold text-pitch hover:underline"
          >
            Sign in
          </Link>{" "}
          to play the knockout pick&apos;em — it&apos;s free.
        </p>
      ) : !gameOpen ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
          The knockout pick&apos;em is locked — the Final has kicked off.
        </p>
      ) : null}

      {/* One tight line: how picking works, then how points are scored (from the
          game catalog so it can't drift from the rules). */}
      <p className="px-1 text-[13px] text-ink-3">
        Predict the exact scoreline of every knockout match — each locks at its own kickoff, and
        the next round opens as its teams are decided. Scoring:{" "}
        {GAME_CATALOG.MATCH_DAY_3_PICKEM.scoringSummary}
      </p>

      <DailyKnockoutForm fixtures={view.fixtures} canEdit={Boolean(user) && gameOpen} />
    </section>
  );
}
