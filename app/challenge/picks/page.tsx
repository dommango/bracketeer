import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/pool/access";
import { getMd3ChallengeHome } from "@/lib/challenge/md3-dashboard";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
import { hasAcceptedTerms } from "@/lib/account/consent";
import {
  getKnockoutState,
  getKnockoutBuilderProjections,
  getTournamentIdBySlug,
} from "@/lib/pool/queries";
import { getStandaloneEntry } from "@/lib/pool/submit-picks";
import { getUserBrackets } from "@/lib/bracket/gallery";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { emptyPicks } from "@/lib/scoring/types";
import { gameStateLine } from "@/lib/pool/games";
import { md3CountLine } from "@/lib/pool/md3-summary";
import { defaultOpenSection } from "@/lib/challenge/picks-summary";
import { Md3ChallengeForm } from "@/app/challenge/md3/Md3ChallengeForm";
import { KnockoutPickForm } from "@/app/pool/[code]/KnockoutPickForm";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { saveSoloBracketAction } from "@/app/bracket/actions";
import { PicksTabs, type PicksSection } from "./PicksTabs";

// Predictions, locks, and live results change at request time.
export const dynamic = "force-dynamic";

export default async function UnifiedPicksPage() {
  const user = await getSessionUser();
  const now = new Date();

  if (!user) {
    return (
      <section className="space-y-4">
        <Header />
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
          <Link
            href="/signin?callbackUrl=/challenge/picks"
            className="font-semibold text-pitch hover:underline"
          >
            Sign in
          </Link>{" "}
          to make your picks across both challenges.
        </p>
      </section>
    );
  }

  const tournamentId = await getTournamentIdBySlug();
  const [{ view }, koState, brackets, accepted] = await Promise.all([
    getMd3ChallengeHome(user.id),
    getKnockoutState(tournamentId),
    getUserBrackets(user.id, tournamentId),
    hasAcceptedTerms(user.id),
  ]);
  const needsConsent = !accepted;
  const gameOpen = isMd3GameOpen(now);

  // --- Match Day Pickem section: always render the form (read-only once locked)
  // with a banner when the game has closed, mirroring /challenge/md3/play. Only
  // MD3 carries consent — the knockout build form does not. ---
  const md3Body: ReactNode = (
    <div className="space-y-3">
      {!gameOpen ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-3 text-center text-sm text-ink-3">
          Match Day Pickem is locked — every fixture has kicked off.
        </p>
      ) : null}
      <Md3ChallengeForm fixtures={view.fixtures} canEdit={gameOpen} needsConsent={needsConsent} />
    </div>
  );

  // --- Knockout Challenge section: mirror /bracket/edit. Before the field is set
  // (and outside early-build) it's a countdown gate, not a form. ---
  const { open, provisional, earlyOpen, opensAt, locksAt, seed, projectedSeed } = koState;
  const early = !open && earlyOpen;
  const buildable = open || earlyOpen;

  const koStandalone = brackets.filter(
    (b) => b.format === "KNOCKOUT" && b.placement.kind === "standalone",
  );
  const primary = koStandalone[0] ?? null;
  const extras = koStandalone.slice(1);

  let koBody: ReactNode;
  let koProgress: string;
  if (!buildable) {
    koProgress = "Opens at the draw";
    koBody = (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink-2">Knockout picks open at the draw</p>
        <p className="mt-1.5 text-sm text-ink-3">Once the field is set, build your bracket here.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-line-soft pt-3">
          <span className="text-sm font-semibold text-pitch-dark">Picks open in</span>
          <Countdown target={opensAt.toISOString()} className="text-sm text-pitch-dark" />
        </div>
      </div>
    );
  } else {
    const [bracket, builder] = await Promise.all([
      primary
        ? getStandaloneEntry(tournamentId, user.id, "KNOCKOUT", primary.entryId)
        : Promise.resolve(null),
      early ? getKnockoutBuilderProjections(tournamentId) : Promise.resolve(null),
    ]);
    const locked = isKnockoutLocked(locksAt, bracket?.locked ?? false);
    koProgress = primary?.progress
      ? `${primary.progress.done}/${primary.progress.total} picks`
      : "Not started";
    koBody = (
      <div className="space-y-3">
        <KnockoutPickForm
          entryId={bracket?.entryId}
          initialPicks={bracket?.picks ?? emptyPicks()}
          initialAdvance={bracket?.knockoutAdvance}
          initialTiebreak={bracket?.tiebreak ?? ""}
          label={bracket?.label ?? user.name ?? "Player"}
          locked={locked}
          seed={early ? projectedSeed : seed}
          provisional={provisional}
          early={early}
          projections={builder?.projections}
          outrights={builder?.outrights}
          saveAction={saveSoloBracketAction}
        />
        {extras.length > 0 ? (
          <p className="text-center text-[13px] text-ink-3">
            You have {extras.length} more bracket{extras.length > 1 ? "s" : ""} —{" "}
            <Link href="/bracket" className="font-semibold text-pitch-dark hover:underline">
              manage all in the gallery
            </Link>
            .
          </p>
        ) : null}
      </div>
    );
  }

  const md3Incomplete = gameOpen && view.openCount > 0;
  const knockoutIncomplete =
    buildable && (primary?.progress ? primary.progress.done < primary.progress.total : true);

  const sections: PicksSection[] = [
    {
      key: "md3",
      title: "Match Day Pickem",
      progress: md3CountLine(view),
      stateLine: gameStateLine("MATCH_DAY_3_PICKEM", now),
      body: md3Body,
    },
    {
      key: "knockout",
      title: "Knockout Challenge",
      progress: koProgress,
      stateLine: gameStateLine("KNOCKOUT", now),
      body: koBody,
    },
  ];

  const defaultOpen = defaultOpenSection({ md3Incomplete, knockoutIncomplete, now });

  return (
    <section className="space-y-4">
      <Header />
      <PicksTabs sections={sections} initial={defaultOpen} />
    </section>
  );
}

function Header() {
  return (
    <div className="px-1">
      <h1 className="font-display text-lg text-ink">Your picks</h1>
      <p className="mt-0.5 text-[13px] text-ink-3">Both public challenges in one place.</p>
    </div>
  );
}
