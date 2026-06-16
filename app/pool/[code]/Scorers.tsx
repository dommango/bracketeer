import type { getTopScorers } from "@/lib/pool/queries";
import { Flag } from "./Flag";
import { TeamLink } from "./TeamLink";
import { PlayerLink } from "./PlayerLink";

// Golden Boot leaderboard (actual goals). Presentational only — data is fetched
// by the caller (the Matches "scorers" sub-view and the legacy redirect both
// reuse this). Betting markets live under the Odds sub-view, not here.
type Scorer = Awaited<ReturnType<typeof getTopScorers>>[number];

export function Scorers({ scorers, code }: { scorers: Scorer[]; code: string }) {
  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Golden Boot
      </h2>
      <p className="mt-1 px-1 text-[11px] text-ink-4">Tournament top scorers.</p>
      {scorers.length === 0 ? (
        <p className="mt-2.5 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
          The top-scorer leaderboard will appear here once matches are under way.
        </p>
      ) : (
        <ul className="mt-2.5 divide-y divide-line-soft rounded-2xl border border-line bg-surface">
          {scorers.map((s) => (
            <li key={s.rank} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 shrink-0 text-center font-mono text-xs font-semibold text-ink-3">
                {s.rank}
              </span>
              <TeamLink poolCode={code} code={s.teamCode}>
                <Flag code={s.teamCode} size={18} />
              </TeamLink>
              <span className="min-w-0 flex-1">
                <PlayerLink poolCode={code} name={s.playerName} className="block truncate text-sm font-semibold text-ink underline-offset-2 hover:underline">
                  {s.playerName}
                </PlayerLink>
                <TeamLink poolCode={code} code={s.teamCode} className="block truncate text-[11px] text-ink-3 underline-offset-2 hover:underline">
                  {s.teamName}
                </TeamLink>
              </span>
              {s.assists != null ? (
                <span className="shrink-0 font-mono text-[11px] text-ink-4">{s.assists}A</span>
              ) : null}
              <span className="w-7 shrink-0 text-right font-display text-xl tabular-nums text-pitch-dark">
                {s.goals}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
