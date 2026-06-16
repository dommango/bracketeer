import { notFound } from "next/navigation";
import { getPoolByCode, getTopScorers, getGoalscorerOutrights } from "@/lib/pool/queries";
import { Flag } from "../Flag";

// Standings change at request time.
export const dynamic = "force-dynamic";

export default async function ScorersPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const [scorers, favorites] = await Promise.all([
    getTopScorers(pool.tournamentId),
    getGoalscorerOutrights(pool.tournamentId),
  ]);

  return (
    <div className="space-y-5">
      {favorites.length > 0 ? (
        <section>
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            Boot favorites
            <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
              from the betting odds
            </span>
          </h2>
          <ul className="mt-2.5 divide-y divide-line-soft rounded-2xl border border-line bg-surface">
            {favorites.map((f, i) => (
              <li key={f.playerName} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-5 shrink-0 text-center font-mono text-xs font-semibold text-ink-3">
                  {i + 1}
                </span>
                {f.teamCode ? <Flag code={f.teamCode} size={18} /> : <span className="w-[18px] shrink-0" />}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {f.playerName}
                </span>
                <span className="w-12 shrink-0 text-right font-display text-lg tabular-nums text-pitch-dark">
                  {Math.round(f.winProb * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
                <Flag code={s.teamCode} size={18} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {s.playerName}
                  </span>
                  <span className="block truncate text-[11px] text-ink-3">{s.teamName}</span>
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
    </div>
  );
}
