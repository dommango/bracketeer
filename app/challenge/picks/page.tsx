import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/pool/access";
import { getDailyKnockoutHome } from "@/lib/challenge/daily-knockout-dashboard";
import { isDailyKnockoutGameOpen } from "@/lib/games/daily-pickem/schedule";
import {
  getKnockoutState,
  getKnockoutBuilderProjections,
  getKnockoutMatchInfo,
  getTournamentIdBySlug,
} from "@/lib/pool/queries";
import { getUserKnockoutEntry } from "@/lib/pool/submit-picks";
import { getUserBrackets, type BracketSummary } from "@/lib/bracket/gallery";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { emptyPicks } from "@/lib/scoring/types";
import { gameStateLine } from "@/lib/pool/games";
import { md3CountLine } from "@/lib/pool/md3-summary";
import { defaultOpenSection } from "@/lib/challenge/picks-summary";
import { DailyKnockoutForm } from "@/app/challenge/md3/DailyKnockoutForm";
import { KnockoutPickForm } from "@/app/pool/[code]/KnockoutPickForm";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { saveSoloBracketAction, saveKnockoutBracketAction } from "@/app/bracket/actions";
import { KnockoutBracketSwitcher, type SwitcherBracket } from "./KnockoutBracketSwitcher";
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
  const [{ view }, koState, brackets] = await Promise.all([
    getDailyKnockoutHome(user.id),
    getKnockoutState(tournamentId),
    getUserBrackets(user.id, tournamentId),
  ]);
  const gameOpen = isDailyKnockoutGameOpen(now);

  // --- Match Day Pickem section: the knockout scoreline pick'em. Free to play, so
  // no consent gate (unlike the retired group leg). Renders read-only with a banner
  // once the Final has kicked off, mirroring /challenge/md3/play. ---
  const md3Body: ReactNode = (
    <div className="space-y-3">
      {!gameOpen ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-3 text-center text-sm text-ink-3">
          The knockout pick&apos;em is locked — the Final has kicked off.
        </p>
      ) : null}
      <DailyKnockoutForm fixtures={view.fixtures} canEdit={gameOpen} />
    </div>
  );

  // --- Knockout Challenge section: mirror /bracket/edit. Before the field is set
  // (and outside early-build) it's a countdown gate, not a form. ---
  const { open, provisional, earlyOpen, opensAt, locksAt, seed, projectedSeed } = koState;
  const early = !open && earlyOpen;
  const buildable = open || earlyOpen;

  // Every knockout bracket the user can edit from the Challenge: ones they've
  // entered (solo OR pooled) plus any standalone draft they're building here.
  // Pooled brackets they haven't entered are edited in their pool, not here.
  const koEditable = brackets.filter(
    (b) => b.format === "KNOCKOUT" && (b.enteredChallenge || b.placement.kind === "standalone"),
  );
  const primary = koEditable[0] ?? null;

  // Toggle label per bracket: the pool name, or "Solo" (numbered when the user
  // keeps more than one standalone bracket) — never the repeated contestant name.
  const koTitle = (b: BracketSummary, i: number): string => {
    if (b.placement.kind === "pool") return b.placement.poolName;
    const soloCount = koEditable.filter((x) => x.placement.kind === "standalone").length;
    if (soloCount <= 1) return "Solo";
    const ordinal = koEditable
      .slice(0, i + 1)
      .filter((x) => x.placement.kind === "standalone").length;
    return `Solo ${ordinal}`;
  };

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
    const [loaded, builder, { info, titleOdds }] = await Promise.all([
      Promise.all(koEditable.map((b) => getUserKnockoutEntry(user.id, b.entryId))),
      early ? getKnockoutBuilderProjections(tournamentId) : Promise.resolve(null),
      getKnockoutMatchInfo(tournamentId),
    ]);
    const activeSeed = early ? projectedSeed : seed;
    // /bracket stays the home for everything else — non-entered brackets and pools.
    const manageLink = (
      <p className="text-center text-[13px] text-ink-3">
        Other brackets and your pools —{" "}
        <Link href="/bracket" className="font-semibold text-pitch-dark hover:underline">
          manage in your brackets
        </Link>
        .
      </p>
    );

    if (koEditable.length === 0) {
      // No bracket yet: build a first standalone one here (created on save).
      koProgress = "Not started";
      koBody = (
        <div className="space-y-3">
          <KnockoutPickForm
            initialPicks={emptyPicks()}
            initialTiebreak=""
            label={user.name ?? "Player"}
            locked={false}
            seed={activeSeed}
            provisional={provisional}
            early={early}
            projections={builder?.projections}
            outrights={builder?.outrights}
            info={info}
            titleOdds={titleOdds}
            saveAction={saveSoloBracketAction}
          />
          {manageLink}
        </div>
      );
    } else {
      const switcherBrackets: SwitcherBracket[] = koEditable.map((b, i) => {
        const entry = loaded[i];
        return {
          entryId: b.entryId,
          title: koTitle(b, i),
          initialPicks: entry?.picks ?? emptyPicks(),
          initialAdvance: entry?.knockoutAdvance ?? {},
          initialTiebreak: entry?.tiebreak ?? "",
          label: entry?.label ?? user.name ?? "Player",
          locked: isKnockoutLocked(locksAt, entry?.locked ?? false),
          progress: b.progress,
        };
      });
      koProgress =
        koEditable.length > 1
          ? `${koEditable.length} brackets`
          : primary?.progress
            ? `${primary.progress.done}/${primary.progress.total} picks`
            : "Not started";
      const first = switcherBrackets[0];
      koBody = (
        <div className="space-y-3">
          {switcherBrackets.length > 1 ? (
            <KnockoutBracketSwitcher
              brackets={switcherBrackets}
              seed={activeSeed}
              provisional={provisional}
              early={early}
              projections={builder?.projections}
              outrights={builder?.outrights}
              info={info}
              titleOdds={titleOdds}
              saveAction={saveKnockoutBracketAction}
            />
          ) : (
            <KnockoutPickForm
              entryId={first.entryId}
              initialPicks={first.initialPicks}
              initialAdvance={first.initialAdvance}
              initialTiebreak={first.initialTiebreak}
              label={first.label}
              locked={first.locked}
              seed={activeSeed}
              provisional={provisional}
              early={early}
              projections={builder?.projections}
              outrights={builder?.outrights}
              info={info}
              titleOdds={titleOdds}
              saveAction={saveKnockoutBracketAction}
            />
          )}
          {manageLink}
        </div>
      );
    }
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
      <h1 className="font-display text-xl text-ink">Your picks</h1>
      <p className="mt-0.5 text-[13px] text-ink-3">Both public challenges in one place.</p>
    </div>
  );
}
