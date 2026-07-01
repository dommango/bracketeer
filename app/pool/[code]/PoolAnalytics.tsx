import { Flag } from "./Flag";
import { TeamLink } from "./TeamLink";
import { teamColor } from "@/lib/teams/colors";
import type { PickAnalytics, PickTally } from "@/lib/pool/pick-analytics";
import type { PoolStandouts, StandoutRow } from "@/lib/pool/standouts";

const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// One decimal, trailing ".0" dropped — EV points are fractional.
function fmtEv(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

// A compact entry leaderboard (upside / contrarian), each row label + a value.
function StandoutList({ rows, suffix }: { rows: StandoutRow[]; suffix: (r: StandoutRow) => string }) {
  return (
    <ol className="mt-2 space-y-1">
      {rows.map((r, i) => (
        <li key={r.entryId} className="flex items-center gap-2.5 text-sm">
          <span className="w-4 shrink-0 text-center font-mono text-[11px] text-ink-4">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-ink">{r.label}</span>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-ink-2">
            {suffix(r)}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Pool-level "standouts" appended to the analytics card: who has the most upside
// left (EV), the boldest brackets (contrarian), and how spread the title race is.
function Standouts({ standouts }: { standouts: PoolStandouts }) {
  const { upside, contrarian, diversity } = standouts;
  if (upside.length === 0 && contrarian.length === 0) return null;
  return (
    <>
      {upside.length > 0 ? (
        <div>
          <p className={LABEL}>Most upside</p>
          <p className="mt-1 text-[11px] text-ink-4">Expected points still to come, on the odds.</p>
          <StandoutList rows={upside} suffix={(r) => `+${fmtEv(r.value)}`} />
        </div>
      ) : null}

      {contrarian.length > 0 ? (
        <div>
          <p className={LABEL}>Boldest brackets</p>
          <p className="mt-1 text-[11px] text-ink-4">
            Champion, finalists &amp; group winners the pool least shares.
          </p>
          <StandoutList rows={contrarian} suffix={(r) => `${r.value}`} />
        </div>
      ) : null}

      <div>
        <p className={LABEL}>Title-race diversity</p>
        <p className="mt-1 text-sm text-ink-2">
          <span className="font-semibold text-ink">{diversity.distinctChampions}</span> distinct{" "}
          {diversity.distinctChampions === 1 ? "champion" : "champions"} backed
          <span className="text-ink-4"> · </span>
          spread index <span className="font-mono font-semibold">{diversity.index.toFixed(2)}</span>
        </p>
      </div>
    </>
  );
}

// The team drill-down base for TeamLink — a pool path by default, or an explicit
// basePath for non-pool callers (the public challenges).
type TeamLinkBase = { poolCode?: string; basePath?: string };

// One ranked pick with a team-colored share bar (mirrors ChampionshipOdds).
function TallyRow({ t, link }: { t: PickTally; link: TeamLinkBase }) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamLink {...link} code={t.code}>
        <Flag code={t.code} size={18} />
      </TeamLink>
      <TeamLink {...link} code={t.code} className="min-w-0 flex-1 truncate text-sm text-ink underline-offset-2 hover:underline">
        {t.name}
      </TeamLink>
      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunk sm:block">
        <span
          className="block h-full rounded-full"
          style={{ width: `${t.pct}%`, background: teamColor(t.code) }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-ink-2">
        {t.count} · {t.pct}%
      </span>
    </div>
  );
}

// Pick consensus: who the field backed, drawn from everyone's brackets. Shared by
// pools (pass `code`) and the public challenge (pass `basePath="/challenge/knockout"`).
export function PoolAnalytics({
  analytics,
  code,
  basePath,
  standouts,
}: {
  analytics: PickAnalytics;
  code?: string;
  basePath?: string;
  standouts?: PoolStandouts | null;
}) {
  const { champion, finalists, groupWinners, contrarian, totalEntries } = analytics;
  if (totalEntries === 0 || !champion.top) return null;

  const link: TeamLinkBase = basePath ? { basePath } : { poolCode: code };

  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Pool picks
        <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
          across {totalEntries} {totalEntries === 1 ? "bracket" : "brackets"}
        </span>
      </h2>

      <div className="mt-2.5 space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]">
        {/* Consensus champion */}
        <div>
          <p className={LABEL}>Consensus champion</p>
          <div className="mt-2 flex items-center gap-3">
            <TeamLink {...link} code={champion.top.code}>
              <Flag code={champion.top.code} size={28} />
            </TeamLink>
            <div className="min-w-0 flex-1">
              <TeamLink {...link} code={champion.top.code} className="block truncate font-display text-xl text-ink underline-offset-2 hover:underline">
                {champion.top.name}
              </TeamLink>
              <p className="text-xs text-ink-3">
                {champion.top.count} of {totalEntries} · {champion.distinctCount}{" "}
                {champion.distinctCount === 1 ? "distinct pick" : "distinct picks"}
              </p>
            </div>
            <span
              className="shrink-0 font-display text-2xl tabular-nums"
              style={{ color: teamColor(champion.top.code) }}
            >
              {champion.top.pct}%
            </span>
          </div>
          {champion.field.length > 1 ? (
            <div className="mt-2.5 space-y-1.5">
              {champion.field.slice(0, 6).map((t) => (
                <TallyRow key={t.code} t={t} link={link} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Finalist favorites */}
        {finalists.length > 0 ? (
          <div>
            <p className={LABEL}>Finalist favorites</p>
            <div className="mt-2 space-y-1.5">
              {finalists.slice(0, 5).map((t) => (
                <TallyRow key={t.code} t={t} link={link} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Most popular group winners — only when the field actually picked them
            (full-bracket pools). Knockout brackets have no group-winner picks, so
            this is empty there and the section is hidden rather than showing dashes. */}
        {groupWinners.some((g) => g.top) ? (
        <div>
          <p className={LABEL}>Group winner favorites</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {groupWinners.map((g) => (
              <div
                key={g.group}
                className="flex items-center gap-1.5 rounded-lg border border-line-soft bg-surface-sunk px-2 py-1.5"
              >
                <span className="w-4 shrink-0 font-mono text-[11px] font-bold text-ink-3">
                  {g.group}
                </span>
                {g.top ? (
                  <>
                    <TeamLink {...link} code={g.top.code}>
                      <Flag code={g.top.code} size={16} />
                    </TeamLink>
                    <TeamLink {...link} code={g.top.code} className="min-w-0 flex-1 truncate text-xs text-ink underline-offset-2 hover:underline">
                      {g.top.name}
                    </TeamLink>
                    <span className="shrink-0 font-mono text-[10px] text-ink-4">{g.top.pct}%</span>
                  </>
                ) : (
                  <span className="text-xs text-ink-4">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
        ) : null}

        {/* Contrarian champion calls */}
        {contrarian.length > 0 ? (
          <div>
            <p className={LABEL}>Contrarian champions</p>
            <p className="mt-1 text-[11px] text-ink-4">Backed by a single bracket.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {contrarian.map((t) => (
                <TeamLink
                  key={t.code}
                  {...link}
                  code={t.code}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink hover:border-pitch"
                >
                  <Flag code={t.code} size={14} /> {t.name}
                </TeamLink>
              ))}
            </div>
          </div>
        ) : null}

        {standouts ? <Standouts standouts={standouts} /> : null}
      </div>
    </section>
  );
}
