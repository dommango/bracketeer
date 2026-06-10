import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { getUserEntry } from "@/lib/pool/submit-picks";
import { arePicksLocked } from "@/lib/pool/lock";
import { emptyPicks } from "@/lib/scoring/types";
import { PickForm } from "../PickForm";
import { Countdown } from "../Countdown";

export const dynamic = "force-dynamic";

export default async function PicksPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
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

  const entry = await getUserEntry(pool.id, sessionUser.id);
  const label = entry?.label ?? sessionUser.name ?? "Player";
  const entryLocked = entry?.locked ?? false;
  const locked = arePicksLocked(pool.tournament.startsAt, entryLocked);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          {entry ? "Edit your picks" : "Make your picks"}
        </h2>
        <Link
          href={`/pool/${code}`}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline"
        >
          ← Pool home
        </Link>
      </div>

      <DeadlineBanner
        startsAt={pool.tournament.startsAt.toISOString()}
        locked={locked}
        entryLocked={entryLocked}
      />

      <PickForm
        code={code}
        initialPicks={entry?.picks ?? emptyPicks()}
        initialTiebreak={entry?.tiebreak ?? ""}
        label={label}
        locked={locked}
      />
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
