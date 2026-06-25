import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getMd3ChallengeHome } from "@/lib/challenge/md3-dashboard";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
import { md3DateRange } from "@/lib/pool/games";
import { hasAcceptedTerms } from "@/lib/account/consent";
import { ScoreCards } from "@/app/pool/[code]/ScoreCards";
import { Md3ChallengeForm } from "../Md3ChallengeForm";

// Predictions, locks, and results change at request time.
export const dynamic = "force-dynamic";

export default async function Md3ChallengePlayPage() {
  const user = await getSessionUser();
  const { view, standing, cards } = await getMd3ChallengeHome(user?.id ?? null);
  const gameOpen = isMd3GameOpen();
  const needsConsent = user ? !(await hasAcceptedTerms(user.id)) : false;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <h1 className="font-display text-lg text-ink">Your predictions</h1>
          <p className="text-[13px] text-ink-3">
            {view.pickedCount}/24 predicted · {view.openCount} still open
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
      ) : (
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-3">
          Predict the exact score of all 24 final group-stage matches ({md3DateRange()}). Each pick
          locks at its own kickoff, and you&apos;re on the public board once all 24 are in.
        </p>
      )}

      {/* Live context while you decide — the same score cards as Home. */}
      <ScoreCards
        live={cards.live}
        last={cards.last}
        next={cards.next}
        hrefForMatch={() => "/challenge/md3/matches"}
      />

      <Md3ChallengeForm
        fixtures={view.fixtures}
        canEdit={Boolean(user) && gameOpen}
        needsConsent={needsConsent}
      />
    </section>
  );
}
