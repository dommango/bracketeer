import Link from "next/link";
import { Leaderboard } from "./Leaderboard";
import { prizeTeaser } from "@/lib/pool/games";
import type { LeaderboardRow } from "@/lib/pool/scoring";
import type { Md3View } from "@/lib/pool/md3-view";

// The Match Day 3 Pickem dashboard — a deliberately lean alternative to the
// bracket-centric Home: a status card, a picks CTA, and the leaderboard.
export function Md3Dashboard({
  code,
  view,
  leaderboard,
  youUserId,
  isMember,
}: {
  code: string;
  view: Md3View;
  leaderboard: LeaderboardRow[];
  youUserId?: string;
  isMember: boolean;
}) {
  const hasPicks = view.pickedCount > 0;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-surface p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
          Match Day 3 Pickem
        </p>
        <h2 className="mt-1 font-display text-xl text-ink">
          Predict the final group-stage scores
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Exact score 5 pts · right result &amp; goal difference 3 · right result 1. Each pick locks
          at kickoff.
        </p>
        {prizeTeaser("MATCH_DAY_3_PICKEM") ? (
          <p className="mt-1.5 text-[12px] font-semibold text-gold-dark">
            🏆 {prizeTeaser("MATCH_DAY_3_PICKEM")} Enter the public challenge from your picks page.
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Predicted" value={`${view.pickedCount}/24`} />
          <Stat label="Open" value={String(view.openCount)} />
          <Stat label="Your points" value={view.scoredCount > 0 ? String(view.totalPoints) : "—"} />
        </dl>

        {isMember ? (
          <Link
            href={`/pool/${code}/md3`}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99]"
          >
            {hasPicks ? "Edit your picks →" : "Make your picks →"}
          </Link>
        ) : (
          <Link
            href={`/pool/${code}/md3`}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface px-[18px] font-semibold text-pitch-dark transition-colors hover:bg-surface-sunk"
          >
            View the fixtures →
          </Link>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Leaderboard
          <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
            {leaderboard.length} {leaderboard.length === 1 ? "entry" : "entries"}
          </span>
        </h3>
        {leaderboard.length > 0 ? (
          <Leaderboard rows={leaderboard} youUserId={youUserId} code={code} showMedals={false} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
            No picks in yet — be the first on the board.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-sunk px-2 py-3">
      <div className="font-display text-xl text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </div>
    </div>
  );
}
