import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import {
  getKnockoutState,
  getKnockoutBuilderProjections,
  getTournamentIdBySlug,
} from "@/lib/pool/queries";
import { getStandaloneEntry } from "@/lib/pool/submit-picks";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { emptyPicks } from "@/lib/scoring/types";
import { KnockoutPickForm } from "@/app/pool/[code]/KnockoutPickForm";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { saveSoloBracketAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SoloBracketEditPage({
  searchParams,
}: {
  searchParams: Promise<{ entryId?: string | string[] }>;
}) {
  const user = await getSessionUser();
  if (!user) return <SignInGate />;

  const { entryId: entryIdParam } = await searchParams;
  const entryId = Array.isArray(entryIdParam) ? entryIdParam[0] : entryIdParam;

  const tournamentId = await getTournamentIdBySlug();
  const { open, provisional, earlyOpen, opensAt, locksAt, seed, projectedSeed } =
    await getKnockoutState(tournamentId);
  const early = !open && earlyOpen;

  const header = (
    <div className="flex items-center justify-between">
      <h1 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        {entryId ? "Your knockout bracket" : "New knockout bracket"}
      </h1>
      <Link
        href="/bracket"
        className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline"
      >
        ← Back
      </Link>
    </div>
  );

  if (!open && !earlyOpen) {
    return (
      <section className="space-y-4">
        {header}
        <Gate>
          <p className="text-sm font-semibold text-ink-2">Knockout picks open at the draw</p>
          <p className="mt-1.5 text-sm text-ink-3">
            Once the group stage wraps and the last 32 are set, build your bracket here.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
            <span className="text-sm font-semibold text-pitch-dark">Picks open in</span>
            <Countdown target={opensAt.toISOString()} className="text-sm text-pitch-dark" />
          </div>
        </Gate>
      </section>
    );
  }

  // With an entryId we edit that standalone bracket; without one this is a fresh
  // bracket (the first save creates it). In early mode we seed from projections and
  // surface the position labels + candidate odds for the not-yet-decided slots.
  const [bracket, builder] = await Promise.all([
    entryId ? getStandaloneEntry(tournamentId, user.id, "KNOCKOUT", entryId) : Promise.resolve(null),
    early ? getKnockoutBuilderProjections(tournamentId) : Promise.resolve(null),
  ]);
  const locked = isKnockoutLocked(locksAt, bracket?.locked ?? false);

  return (
    <section className="space-y-4">
      {header}
      <DeadlineBanner
        locksAt={locksAt ? locksAt.toISOString() : null}
        locked={locked}
        entryLocked={bracket?.locked ?? false}
      />
      <KnockoutPickForm
        entryId={bracket?.entryId}
        initialPicks={bracket?.picks ?? emptyPicks()}
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
    </section>
  );
}

function DeadlineBanner({
  locksAt,
  locked,
  entryLocked,
}: {
  locksAt: string | null;
  locked: boolean;
  entryLocked: boolean;
}) {
  if (locked) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-surface-sunk px-4 py-3 text-sm text-ink-2">
        <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-ink-4" />
        Picks are locked — {entryLocked ? "set by an admin." : "the Round of 32 has kicked off."}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-pitch-tint px-4 py-3">
      <span className="text-sm font-semibold text-pitch-dark">Picks lock at the Round of 32 kickoff</span>
      {locksAt ? <Countdown target={locksAt} className="text-sm text-pitch-dark" /> : null}
    </div>
  );
}

function SignInGate() {
  return (
    <section className="space-y-4">
      <Gate>
        <p className="text-sm text-ink-3">Sign in to build your bracket.</p>
        <Link
          href="/signin"
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
        >
          Sign in →
        </Link>
      </Gate>
    </section>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      {children}
    </div>
  );
}
