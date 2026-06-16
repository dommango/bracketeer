import { Flag } from "./Flag";
import { TeamLink } from "./TeamLink";
import { teamColor } from "@/lib/teams/colors";
import type { PickAnalytics, PickTally } from "@/lib/pool/pick-analytics";

const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// One ranked pick with a team-colored share bar (mirrors ChampionshipOdds).
function TallyRow({ t, code }: { t: PickTally; code: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamLink poolCode={code} code={t.code}>
        <Flag code={t.code} size={18} />
      </TeamLink>
      <TeamLink poolCode={code} code={t.code} className="min-w-0 flex-1 truncate text-sm text-ink underline-offset-2 hover:underline">
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

// Pool-wide pick consensus: who the group backed, drawn from everyone's brackets.
export function PoolAnalytics({ analytics, code }: { analytics: PickAnalytics; code: string }) {
  const { champion, finalists, groupWinners, contrarian, totalEntries } = analytics;
  if (totalEntries === 0 || !champion.top) return null;

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
            <TeamLink poolCode={code} code={champion.top.code}>
              <Flag code={champion.top.code} size={28} />
            </TeamLink>
            <div className="min-w-0 flex-1">
              <TeamLink poolCode={code} code={champion.top.code} className="block truncate font-display text-xl text-ink underline-offset-2 hover:underline">
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
                <TallyRow key={t.code} t={t} code={code} />
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
                <TallyRow key={t.code} t={t} code={code} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Most popular group winners */}
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
                    <TeamLink poolCode={code} code={g.top.code}>
                      <Flag code={g.top.code} size={16} />
                    </TeamLink>
                    <TeamLink poolCode={code} code={g.top.code} className="min-w-0 flex-1 truncate text-xs text-ink underline-offset-2 hover:underline">
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

        {/* Contrarian champion calls */}
        {contrarian.length > 0 ? (
          <div>
            <p className={LABEL}>Contrarian champions</p>
            <p className="mt-1 text-[11px] text-ink-4">Backed by a single bracket.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {contrarian.map((t) => (
                <TeamLink
                  key={t.code}
                  poolCode={code}
                  code={t.code}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink hover:border-pitch"
                >
                  <Flag code={t.code} size={14} /> {t.name}
                </TeamLink>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
