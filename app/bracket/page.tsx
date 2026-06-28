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
  const [{ open, earlyOpen, opensAt, locksAt }, brackets, accepted] = await Promise.all([
    getKnockoutState(tournamentId),
    getUserBrackets(user.id, tournamentId),
    hasAcceptedTerms(user.id),
  ]);
  const knockoutLocked = isKnockoutLocked(locksAt);
  // The builder is reachable once picks are open OR early projected-fill is live.
  const buildable = open || earlyOpen;
  const early = !open && earlyOpen;
  const needsConsent = !accepted;

  // Two buckets, not one flat list: brackets that live in a pool you created or
  // joined, vs the public Bracketeer challenges you play solo. The different game
  // formats (knockout, Match Day Pickem) share the same path, so the only split
  // worth surfacing is pool vs community.
  const pooledBrackets = brackets.filter((b) => b.placement.kind === "pool");
  const communityBrackets = brackets.filter((b) => b.placement.kind === "standalone");

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-ink">Your brackets</h1>
        <p className="text-sm text-ink-3">
          The community games you play solo and the brackets in your pools, all in one place.
        </p>
        <Link
          href="/challenge/knockout/scoring"
          className="inline-block text-sm font-semibold text-pitch underline-offset-2 hover:underline"
        >
          How scoring works →
        </Link>
      </header>

      <Section
        title="Community games"
        subtitle="Public Bracketeer challenges you play solo — the Knockout Challenge and Match Day Pickem."
      >
        {!buildable ? (
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
        ) : communityBrackets.length === 0 ? (
          <Card>
            <p className="text-sm font-semibold text-ink-2">You haven&apos;t built a bracket yet</p>
            <p className="mt-1.5 text-sm text-ink-3">
              {early
                ? "Get a head start — build now against the projected seeds, and your picks update to the real teams as the groups finish."
                : "Pick a winner for every knockout match, from the Round of 32 to the final."}
            </p>
            <Link href="/bracket/edit" className={PRIMARY_BTN}>
              Build your bracket →
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            <BracketList
              bucket={communityBrackets}
              knockoutLocked={knockoutLocked}
              needsConsent={needsConsent}
            />
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
      </Section>

      {pooledBrackets.length > 0 ? (
        <Section title="Pools" subtitle="Brackets in pools you've created or joined.">
          <BracketList
            bucket={pooledBrackets}
            knockoutLocked={knockoutLocked}
            needsConsent={needsConsent}
          />
        </Section>
      ) : null}

      <Link
        href="/challenge/knockout"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
      >
        <span className="text-sm font-semibold text-ink">Knockout Challenge leaderboard</span>
        <span className="font-display text-pitch-dark">→</span>
      </Link>
    </section>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[11px] text-ink-3">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

// The card title a standalone (community-game) bracket gets, by its game.
function communityLabel(format: BracketSummary["format"]): string {
  if (format === "KNOCKOUT") return "Knockout bracket";
  if (format === "MATCH_DAY_3_PICKEM") return "Match Day Pickem";
  return "Bracket";
}

// Renders one bucket of brackets. Pooled cards are titled by their pool; community
// cards by their game (numbered when a bucket holds more than one of the same game)
// so the titles stay distinct without falling back to the repeated contestant name.
function BracketList({
  bucket,
  knockoutLocked,
  needsConsent,
}: {
  bucket: BracketSummary[];
  knockoutLocked: boolean;
  needsConsent: boolean;
}) {
  const titleFor = (b: BracketSummary, i: number): string => {
    if (b.placement.kind === "pool") return b.placement.poolName;
    const base = communityLabel(b.format);
    const sameGame = (x: BracketSummary) =>
      x.placement.kind === "standalone" && x.format === b.format;
    if (bucket.filter(sameGame).length <= 1) return base;
    // Ordinal = how many same-game standalone brackets up to and including this one.
    return `${base} ${bucket.slice(0, i + 1).filter(sameGame).length}`;
  };
  return (
    <div className="space-y-4">
      {bucket.map((b, i) => (
        <BracketCard
          key={b.entryId}
          bracket={b}
          title={titleFor(b, i)}
          knockoutLocked={knockoutLocked}
          needsConsent={needsConsent}
        />
      ))}
    </div>
  );
}

function BracketCard({
  bracket,
  title,
  knockoutLocked,
  needsConsent,
}: {
  bracket: BracketSummary;
  title: string;
  knockoutLocked: boolean;
  needsConsent: boolean;
}) {
  const isKnockout = bracket.format === "KNOCKOUT";
  const pooled = bracket.placement.kind === "pool";
  // Standalone knockout brackets are edited here; pooled brackets are edited in
  // their pool's picks page; a standalone Match Day Pickem entry is viewed on its
  // own surface (not the knockout editor).
  const editHref =
    bracket.placement.kind === "pool"
      ? `/pool/${bracket.placement.joinCode}/picks`
      : bracket.format === "MATCH_DAY_3_PICKEM"
        ? "/challenge/md3"
        : `/bracket/edit?entryId=${bracket.entryId}`;
  const canEdit = isKnockout && !knockoutLocked && !bracket.locked;
  const pointsCaption =
    bracket.format === "KNOCKOUT"
      ? "Knockout points"
      : bracket.format === "MATCH_DAY_3_PICKEM"
        ? "Match Day points"
        : "Full-tournament points";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            {title}
          </p>
          <p className="mt-1 font-display text-3xl tabular-nums text-ink">
            {bracket.total}
            <span className="ml-1 text-sm font-normal text-ink-3">pts</span>
          </p>
          <p className="mt-0.5 text-[11px] text-ink-3">{pointsCaption}</p>
        </div>
        {bracket.progress ? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-ink-3">
            {bracket.progress.done}/{bracket.progress.total} picked
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
