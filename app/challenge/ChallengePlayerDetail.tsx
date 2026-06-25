import Link from "next/link";
import type { PlayerDetail } from "@/lib/pool/player-detail";
import { roundLabel } from "@/lib/pool/rounds";
import { Flag } from "@/app/pool/[code]/Flag";
import { TeamLink } from "@/app/pool/[code]/TeamLink";

// Player drill-down for the public challenges — the same Golden Boot profile the
// pool shows (team, goal tally, title odds, goal-by-goal log), drilling down via
// the challenge `basePath` rather than a pool path. Tournament-scoped data
// (getPlayerDetail) carries no pool context.
const LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

function minuteLabel(minute: number, extra: number | null): string {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

function Goals({ detail, basePath }: { detail: PlayerDetail; basePath: string }) {
  if (detail.goalEvents.length === 0) return null;
  return (
    <section>
      <h2 className={LABEL}>
        Goals
        <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
          {detail.goalEvents.length}
        </span>
      </h2>
      <ul className="mt-2.5 divide-y divide-line-soft rounded-2xl border border-line bg-surface">
        {detail.goalEvents.map((g, i) => (
          <li key={`${g.matchNo}-${g.minute}-${i}`}>
            <Link
              href={`${basePath}/matches/${g.matchNo}`}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-sunk"
            >
              <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-pitch-dark">
                {minuteLabel(g.minute, g.extraMinute)}
              </span>
              <span className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">
                {roundLabel(g.roundCode)}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-xs text-ink-3">vs</span>
                <Flag code={g.opponentCode} size={16} />
                <span className="min-w-0 truncate text-sm text-ink">{g.opponentCode ?? "—"}</span>
              </span>
              {g.penalty ? (
                <span className="shrink-0 rounded-full bg-surface-sunk px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">
                  Pen
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChallengePlayerDetail({
  detail,
  basePath,
}: {
  detail: PlayerDetail;
  basePath: string;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={LABEL}>Player</h2>
        <Link
          href={`${basePath}/matches`}
          className="rounded-full px-2 py-1 text-xs font-semibold text-pitch underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
        >
          ← All matches
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        <TeamLink basePath={basePath} code={detail.teamCode}>
          <Flag code={detail.teamCode} size={36} />
        </TeamLink>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl text-ink">{detail.name}</p>
          <p className="text-xs text-ink-3">
            {detail.teamName ? (
              <TeamLink basePath={basePath} code={detail.teamCode} className="underline-offset-2 hover:underline">
                {detail.teamName}
              </TeamLink>
            ) : (
              "—"
            )}
            {detail.rank != null ? ` · #${detail.rank} top scorer` : ""}
          </p>
        </div>
        {detail.goals != null ? (
          <span className="shrink-0 text-right">
            <span className="block font-display text-3xl tabular-nums text-pitch-dark">
              {detail.goals}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">
              {detail.goals === 1 ? "goal" : "goals"}
              {detail.assists != null ? ` · ${detail.assists}A` : ""}
            </span>
          </span>
        ) : null}
      </div>

      {detail.odds ? (
        <section>
          <h2 className={LABEL}>Golden Boot odds</h2>
          <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
            <span className="text-sm text-ink-2">Market-implied chance of finishing top scorer</span>
            <span className="shrink-0 font-display text-2xl tabular-nums text-pitch-dark">
              {Math.round(detail.odds.winProb * 100)}%
            </span>
          </div>
        </section>
      ) : null}

      <Goals detail={detail} basePath={basePath} />
    </section>
  );
}
