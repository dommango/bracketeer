import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getKnockoutState } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { getUserEntry, getUserEntries } from "@/lib/pool/submit-picks";
import { arePicksLocked } from "@/lib/pool/lock";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { emptyPicks } from "@/lib/scoring/types";
import { PickForm } from "../PickForm";
import { KnockoutPickForm } from "../KnockoutPickForm";
import { Countdown } from "../Countdown";

export const dynamic = "force-dynamic";

export default async function PicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ entry?: string | string[] }>;
}) {
  const { code } = await params;
  const { entry: entryParam } = await searchParams;
  const selectedParam = Array.isArray(entryParam) ? entryParam[0] : entryParam;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return (
      <Gate>
        <p className="text-sm text-ink-3">Sign in to fill out your bracket.</p>
        <Link
          href="/signin"
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
        >
          Sign in →
        </Link>
      </Gate>
    );
  }

  const access = await getPoolAccess(pool.id);
  if (!access) {
    return (
      <Gate>
        <p className="text-sm text-ink-3">Join this pool before submitting your picks.</p>
        <Link
          href={`/join?code=${pool.joinCode}`}
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
        >
          Join pool →
        </Link>
      </Gate>
    );
  }

  // A user can own several brackets in a pool (e.g. claimed CSV imports), so the
  // form must edit an explicit one. With >1 bracket and no valid selection, show
  // a chooser; one or zero brackets keeps the direct create/edit flow.
  const entries = await getUserEntries(pool.id, sessionUser.id);
  const selected =
    entries.length === 1
      ? entries[0]
      : entries.find((e) => e.entryId === selectedParam) ?? null;

  if (entries.length > 1 && !selected) {
    return <BracketChooser code={code} entries={entries} />;
  }

  const entry = selected ? await getUserEntry(pool.id, sessionUser.id, selected.entryId) : null;
  const label = entry?.label ?? sessionUser.name ?? "Player";
  const entryLocked = entry?.locked ?? false;

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        {entry ? "Edit your picks" : "Make your picks"}
      </h2>
      <Link
        href={entries.length > 1 ? `/pool/${code}/picks` : `/pool/${code}`}
        className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline"
      >
        {entries.length > 1 ? "← Your brackets" : "← Pool home"}
      </Link>
    </div>
  );

  const editing =
    entries.length > 1 && entry ? (
      <p className="px-1 text-sm text-ink-2">
        Editing <span className="font-semibold text-ink">{entry.label}</span>
      </p>
    ) : null;

  // Knockout Challenge: picks open once the 32 qualifiers are set and lock at the
  // Round-of-32 kickoff (not the long-past tournament start). Until the field is
  // set there's nothing to pick, so show a clear "opens at the draw" gate.
  if (pool.format === "KNOCKOUT") {
    const { open, opensAt, locksAt, seed } = await getKnockoutState(pool.tournament.id);
    if (!open) {
      return (
        <section className="space-y-4">
          {header}
          <Gate>
            <p className="text-sm font-semibold text-ink-2">Knockout picks open at the draw</p>
            <p className="mt-1.5 text-sm text-ink-3">
              Once the group stage wraps and the last 32 are set, fill out your bracket here. We’ll
              notify the pool when it unlocks.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
              <span className="text-sm font-semibold text-pitch-dark">Picks open in</span>
              <Countdown target={opensAt.toISOString()} className="text-sm text-pitch-dark" />
            </div>
          </Gate>
        </section>
      );
    }
    const locked = isKnockoutLocked(locksAt, entryLocked);
    return (
      <section className="space-y-4">
        {header}
        {editing}
        <KnockoutDeadlineBanner
          locksAt={locksAt ? locksAt.toISOString() : null}
          locked={locked}
          entryLocked={entryLocked}
        />
        <KnockoutPickForm
          code={code}
          entryId={entry?.entryId}
          initialPicks={entry?.picks ?? emptyPicks()}
          initialTiebreak={entry?.tiebreak ?? ""}
          label={label}
          locked={locked}
          seed={seed}
        />
      </section>
    );
  }

  const locked = arePicksLocked(pool.tournament.startsAt, entryLocked);
  return (
    <section className="space-y-4">
      {header}
      {editing}
      <DeadlineBanner
        startsAt={pool.tournament.startsAt.toISOString()}
        locked={locked}
        entryLocked={entryLocked}
      />
      <PickForm
        code={code}
        entryId={entry?.entryId}
        initialPicks={entry?.picks ?? emptyPicks()}
        initialTiebreak={entry?.tiebreak ?? ""}
        label={label}
        locked={locked}
      />
    </section>
  );
}

function KnockoutDeadlineBanner({
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
        Picks are locked — {entryLocked ? "set by your pool admin." : "the Round of 32 has kicked off."}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-pitch-tint px-4 py-3">
      <span className="text-sm font-semibold text-pitch-dark">Picks lock at the Round-of-32 kickoff</span>
      {locksAt ? <Countdown target={locksAt} className="text-sm text-pitch-dark" /> : null}
    </div>
  );
}

function BracketChooser({
  code,
  entries,
}: {
  code: string;
  entries: { entryId: string; label: string; locked: boolean }[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Your brackets
        </h2>
        <Link
          href={`/pool/${code}`}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline"
        >
          ← Pool home
        </Link>
      </div>
      <p className="px-1 text-sm text-ink-3">You have more than one bracket here. Pick one to edit.</p>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.entryId}>
            <Link
              href={`/pool/${code}/picks?entry=${e.entryId}`}
              className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
            >
              <span className="font-semibold text-ink">{e.label}</span>
              {e.locked ? (
                <span className="text-xs font-semibold text-ink-3">Locked</span>
              ) : (
                <span className="font-display text-pitch-dark">→</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeadlineBanner({
  startsAt,
  locked,
  entryLocked,
}: {
  startsAt: string;
  locked: boolean;
  entryLocked: boolean;
}) {
  if (locked) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-surface-sunk px-4 py-3 text-sm text-ink-2">
        <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-ink-4" />
        Picks are locked — {entryLocked ? "set by your pool admin." : "the tournament has kicked off."}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-pitch-tint px-4 py-3">
      <span className="text-sm font-semibold text-pitch-dark">Picks lock at kickoff</span>
      <Countdown target={startsAt} className="text-sm text-pitch-dark" />
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      {children}
    </div>
  );
}
