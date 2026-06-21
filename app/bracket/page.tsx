import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getKnockoutState, getTournamentIdBySlug } from "@/lib/pool/queries";
import { getSoloBracket } from "@/lib/master/solo";
import { isKnockoutLocked, knockoutOnlyPicks } from "@/lib/pool/knockout";
import { knockoutOnlyProgress } from "@/lib/pool/pick-form";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { MasterToggle } from "./MasterToggle";

export const dynamic = "force-dynamic";

export default async function SoloBracketPage() {
  const user = await getSessionUser();
  if (!user) return <SignInGate />;

  const tournamentId = await getTournamentIdBySlug();
  const [{ open, opensAt, locksAt }, bracket] = await Promise.all([
    getKnockoutState(tournamentId),
    getSoloBracket(user.id),
  ]);
  const locked = isKnockoutLocked(locksAt, bracket?.locked ?? false);
  const progress = bracket ? knockoutOnlyProgress(knockoutOnlyPicks(bracket.picks)) : null;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-ink">Your bracket</h1>
        <p className="text-sm text-ink-3">
          Build your own knockout bracket — no pool needed — and enter the global tournament.
        </p>
      </header>

      {!open ? (
        <Card>
          <p className="text-sm font-semibold text-ink-2">Knockout picks open at the draw</p>
          <p className="mt-1.5 text-sm text-ink-3">
            Once the last 32 are confirmed, build your bracket here.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
            <span className="text-sm font-semibold text-pitch-dark">Picks open in</span>
            <Countdown target={opensAt.toISOString()} className="text-sm text-pitch-dark" />
          </div>
        </Card>
      ) : !bracket ? (
        <Card>
          <p className="text-sm font-semibold text-ink-2">You haven&apos;t built a bracket yet</p>
          <p className="mt-1.5 text-sm text-ink-3">
            Pick a winner for every knockout match, from the Round of 32 to the final.
          </p>
          <Link
            href="/bracket/edit"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
          >
            Build your bracket →
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
                  {bracket.label}
                </p>
                <p className="mt-1 font-display text-3xl tabular-nums text-ink">
                  {bracket.total}
                  <span className="ml-1 text-sm font-normal text-ink-3">pts</span>
                </p>
              </div>
              {progress ? (
                <span className="font-mono text-xs tabular-nums text-ink-3">
                  {progress.overall.done}/{progress.overall.total} picked
                </span>
              ) : null}
            </div>
            <Link
              href="/bracket/edit"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-pitch hover:bg-surface-sunk"
            >
              {locked ? "View bracket" : "Edit bracket"} →
            </Link>
          </Card>

          <MasterToggle entered={bracket.enteredMaster} />
        </div>
      )}

      <Link
        href="/master"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
      >
        <span className="text-sm font-semibold text-ink">Master tournament leaderboard</span>
        <span className="font-display text-pitch-dark">→</span>
      </Link>
    </section>
  );
}

function SignInGate() {
  return (
    <section className="space-y-4">
      <Card>
        <p className="text-sm text-ink-3">Sign in to build your own bracket.</p>
        <Link
          href="/signin"
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
        >
          Sign in →
        </Link>
      </Card>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-5">{children}</div>;
}
