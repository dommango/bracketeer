import type { getStatLeaders } from "@/lib/pool/queries";
import { Flag } from "./Flag";
import { TeamLink } from "./TeamLink";
import { PlayerLink } from "./PlayerLink";
import { UpdatedAt } from "./UpdatedAt";

// Secondary stat leaderboards shown under the Golden Boot in the Scorers view:
// assist leaders + the disciplinary boards. Presentational only — data is fetched
// by the caller (both the pool Matches "scorers" sub-view and the public challenge
// reuse this). Rows drill down via `code` (pool path) or `basePath` (challenge);
// with neither, rows render unlinked (mirrors Scorers).
type Leaders = Awaited<ReturnType<typeof getStatLeaders>>;
type Row = Leaders["assists"][number];

function Board({
  title,
  blurb,
  rows,
  accentClass,
  code,
  basePath,
}: {
  title: string;
  blurb: string;
  rows: Row[];
  accentClass: string;
  code?: string;
  basePath?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{title}</h2>
        <UpdatedAt date={rows[0]?.fetchedAt} />
      </div>
      <p className="mt-1 px-1 text-[11px] text-ink-4">{blurb}</p>
      <ul className="mt-2.5 divide-y divide-line-soft rounded-2xl border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.rank} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-5 shrink-0 text-center font-mono text-xs font-semibold text-ink-3">
              {r.rank}
            </span>
            <TeamLink poolCode={code} basePath={basePath} code={r.teamCode}>
              <Flag code={r.teamCode} size={18} />
            </TeamLink>
            <span className="min-w-0 flex-1">
              <PlayerLink poolCode={code} basePath={basePath} name={r.playerName} className="block truncate text-sm font-semibold text-ink underline-offset-2 hover:underline">
                {r.playerName}
              </PlayerLink>
              <TeamLink poolCode={code} basePath={basePath} code={r.teamCode} className="block truncate text-[11px] text-ink-3 underline-offset-2 hover:underline">
                {r.teamName}
              </TeamLink>
            </span>
            <span className={`w-7 shrink-0 text-right font-display text-xl tabular-nums ${accentClass}`}>
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatLeaders({
  leaders,
  code,
  basePath,
}: {
  leaders: Leaders;
  code?: string;
  basePath?: string;
}) {
  // Nothing polled yet → render nothing (the Golden Boot above already shows its
  // own empty state, so we don't double up on placeholders).
  if (leaders.assists.length === 0 && leaders.yellowCards.length === 0 && leaders.redCards.length === 0) {
    return null;
  }
  return (
    <div className="space-y-6">
      <Board
        title="Assist Kings"
        blurb="Most assists in the tournament."
        rows={leaders.assists}
        accentClass="text-pitch-dark"
        code={code}
        basePath={basePath}
      />
      <Board
        title="Yellow Cards"
        blurb="Most cautioned players."
        rows={leaders.yellowCards}
        accentClass="text-amber-500"
        code={code}
        basePath={basePath}
      />
      <Board
        title="Red Cards"
        blurb="Most dismissals."
        rows={leaders.redCards}
        accentClass="text-red-600"
        code={code}
        basePath={basePath}
      />
    </div>
  );
}
