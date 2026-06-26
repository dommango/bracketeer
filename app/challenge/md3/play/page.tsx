import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getMd3ChallengeHome } from "@/lib/challenge/md3-dashboard";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
import { hasAcceptedTerms } from "@/lib/account/consent";
import { GAME_CATALOG, md3DateRange } from "@/lib/pool/games";
import { Md3ChallengeForm } from "../Md3ChallengeForm";

// Predictions, locks, and results change at request time.
export const dynamic = "force-dynamic";

export default async function Md3ChallengePlayPage() {
  const user = await getSessionUser();
  const { view, standing } = await getMd3ChallengeHome(user?.id ?? null);
  const gameOpen = isMd3GameOpen();
  const needsConsent = user ? !(await hasAcceptedTerms(user.id)) : false;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="font-display text-lg text-ink">Your picks</h1>
          <p className="text-[13px] text-ink-3">
            {view.pickedCount}/24 picked · {view.openCount} still open
            {view.scoredCount > 0 ? ` · ${view.totalPoints} pts` : ""}
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
          to enter Match Day Pickem.
        </p>
      ) : !gameOpen ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
          Match Day Pickem is locked — every fixture has kicked off.
        </p>
      ) : null}

      {/* One tight line: the date range + per-match lock, then how points are
          scored (straight from the game catalog so it can't drift from the rules). */}
      <p className="px-1 text-[13px] text-ink-3">
        Predict the exact scorelines for Match Day 3 ({md3DateRange()}) — each locks at kickoff.
        Scoring: {GAME_CATALOG.MATCH_DAY_3_PICKEM.scoringSummary}
      </p>

      <Md3ChallengeForm
        fixtures={view.fixtures}
        canEdit={Boolean(user) && gameOpen}
        needsConsent={needsConsent}
      />
    </section>
  );
}
