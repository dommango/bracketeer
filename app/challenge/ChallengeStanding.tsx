import Link from "next/link";
import type { Standing } from "@/lib/pool/home";
import { CountUp } from "@/app/pool/[code]/CountUp";

// The viewer's standing on a challenge board — the public-board analogue of the
// pool Home StandingCard. Renders an empty-state CTA when the viewer has no
// (ranked) entry yet. Gold ring when leading. Shared by MD3 and Knockout Home.
export function ChallengeStanding({
  standing,
  boardHref,
  cta,
}: {
  standing: Standing | null;
  boardHref: string;
  // The primary action when the viewer isn't yet ranked (or to edit their entry).
  cta: { href: string; label: string };
}) {
  if (!standing) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
        <p className="text-sm font-semibold text-ink-2">You&apos;re not on the leaderboard yet</p>
        <p className="mt-1.5 text-sm text-ink-3">
          Complete your entry to take your place on the global leaderboard.
        </p>
        <Link
          href={cta.href}
          className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.98]"
        >
          {cta.label} →
        </Link>
      </div>
    );
  }

  const leading = standing.rank === 1;
  return (
    <div
      className={`rounded-2xl border bg-surface p-5 ${
        leading ? "border-gold shadow-[0_0_0_2px_var(--gold-tint)]" : "border-line shadow-[var(--shadow-xs)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Your standing</p>
          <p className="mt-1 truncate font-semibold text-ink">{standing.label}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[28px] leading-none tabular-nums text-ink">
            <CountUp value={standing.total} />
            <span className="ml-1 text-sm font-normal text-ink-3">pts</span>
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-ink-3">
            Rank {standing.rank} / {standing.entryCount}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-soft pt-3 text-[13px]">
        {leading ? (
          <span className="font-semibold text-gold-dark">🥇 You&apos;re leading</span>
        ) : (
          <>
            {standing.gapToNext !== null ? (
              <span className="text-ink-2">
                <span className="font-mono font-semibold tabular-nums text-ink">{standing.gapToNext}</span> to
                the spot above
              </span>
            ) : null}
            <span className="text-ink-3">
              <span className="font-mono font-semibold tabular-nums text-ink-2">{standing.gapToLeader}</span> behind
              the leader
            </span>
          </>
        )}
        <Link href={boardHref} className="ml-auto text-xs font-semibold text-pitch hover:underline">
          Full leaderboard →
        </Link>
      </div>
    </div>
  );
}
