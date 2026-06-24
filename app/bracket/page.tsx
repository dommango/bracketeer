import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getKnockoutState, getTournamentIdBySlug } from "@/lib/pool/queries";
import { getUserBrackets, type BracketSummary } from "@/lib/bracket/gallery";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { hasAcceptedTerms } from "@/lib/account/consent";
import { Countdown } from "@/app/pool/[code]/Countdown";
import { ChallengeToggle } from "./ChallengeToggle";
import { AttachToPoolForm } from "./AttachToPoolForm";

export const dynamic = "force-dynamic";

export default async function BracketsPage() {
  const user = await getSessionUser();
  if (!user) return <SignInGate />;

  const tournamentId = await getTournamentIdBySlug();
  const [{ open, opensAt, locksAt }, brackets, accepted] = await Promise.all([
    getKnockoutState(tournamentId),
    getUserBrackets(user.id, tournamentId),
    hasAcceptedTerms(user.id),
  ]);
  const knockoutLocked = isKnockoutLocked(locksAt);
  const needsConsent = !accepted;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-ink">Your brackets</h1>
        <p className="text-sm text-ink-3">
          Build a knockout bracket, enter it into the Knockout Challenge, and add it to
          any pool you like.
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
      ) : brackets.length === 0 ? (
        <Card>
          <p className="text-sm font-semibold text-ink-2">You haven&apos;t built a bracket yet</p>
          <p className="mt-1.5 text-sm text-ink-3">
            Pick a winner for every knockout match, from the Round of 32 to the final.
          </p>
          <Link href="/bracket/edit" className={PRIMARY_BTN}>
            Build your bracket →
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {brackets.map((b) => (
            <BracketCard
              key={b.entryId}
              bracket={b}
              knockoutLocked={knockoutLocked}
              needsConsent={needsConsent}
            />
          ))}
          {!knockoutLocked ? (
            <Link
              href="/bracket/edit"
              className="flex h-12 items-center justify-center rounded-2xl border border-dashed border-line text-sm font-semibold text-pitch hover:bg-surface-sunk"
            >
              + New bracket
            </Link>
          ) : null}
        </div>
      )}

      <Link
        href="/challenge"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
      >
        <span className="text-sm font-semibold text-ink">Knockout Challenge leaderboard</span>
        <span className="font-display text-pitch-dark">→</span>
      </Link>
    </section>
  );
}

function BracketCard({
  bracket,
  knockoutLocked,
  needsConsent,
}: {
  bracket: BracketSummary;
  knockoutLocked: boolean;
  needsConsent: boolean;
}) {
  const isKnockout = bracket.format === "KNOCKOUT";
  const pooled = bracket.placement.kind === "pool";
  // Standalone knockout brackets are edited here; pooled brackets are edited in
  // their pool's picks page (knockout) — full-bracket pools lock at kickoff.
  const editHref =
    bracket.placement.kind === "pool"
      ? `/pool/${bracket.placement.joinCode}/picks`
      : `/bracket/edit?entryId=${bracket.entryId}`;
  const canEdit = isKnockout && !knockoutLocked && !bracket.locked;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            {bracket.label}
          </p>
          <p className="mt-1 font-display text-3xl tabular-nums text-ink">
            {bracket.total}
            <span className="ml-1 text-sm font-normal text-ink-3">pts</span>
          </p>
        </div>
        {bracket.progress ? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-ink-3">
            {bracket.progress.done}/{bracket.progress.total} picked
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-2">
          {pooled && bracket.placement.kind === "pool" ? bracket.placement.poolName : "Standalone"}
        </span>
        {bracket.enteredChallenge ? (
          <span className="rounded-full bg-pitch-tint px-2 py-0.5 text-[11px] font-semibold text-pitch-dark">
            In the Challenge
          </span>
        ) : null}
        {!isKnockout ? (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-3">
            Full Tournament
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line-soft pt-3">
        <Link
          href={editHref}
          className="inline-flex h-9 items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-pitch hover:bg-surface-sunk"
        >
          {canEdit ? "Edit" : "View"} →
        </Link>
        {pooled && bracket.placement.kind === "pool" ? (
          <Link
            href={`/pool/${bracket.placement.joinCode}`}
            className="text-xs font-semibold text-ink-3 underline-offset-2 hover:text-ink-2 hover:underline"
          >
            Open pool →
          </Link>
        ) : isKnockout ? (
          <AttachToPoolForm entryId={bracket.entryId} />
        ) : null}
      </div>

      {isKnockout ? (
        <div className="mt-3">
          <ChallengeToggle
            entryId={bracket.entryId}
            entered={bracket.enteredChallenge}
            needsConsent={needsConsent}
          />
        </div>
      ) : null}
    </Card>
  );
}

function SignInGate() {
  return (
    <section className="space-y-4">
      <Card>
        <p className="text-sm text-ink-3">Sign in to build your bracket.</p>
        <Link href="/signin" className={PRIMARY_BTN}>
          Sign in →
        </Link>
      </Card>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-5">{children}</div>;
}

const PRIMARY_BTN =
  "mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark";
