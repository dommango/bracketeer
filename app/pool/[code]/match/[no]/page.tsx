import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getMatchPickSplit } from "@/lib/pool/pickSplit";
import { Flag } from "../../Flag";

export const dynamic = "force-dynamic";

// Pick distributions change as picks are claimed/imported and as results land.
export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ code: string; no: string }>;
}) {
  const { code, no } = await params;
  const matchNo = Number(no);
  const pool = await getPoolByCode(code);
  if (!pool || !Number.isInteger(matchNo)) notFound();

  const split = await getMatchPickSplit(pool.id, matchNo);
  if (!split) notFound();

  const maxCount = split.shares.reduce((m, s) => Math.max(m, s.count), 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/pool/${code}#bracket`}
        className="text-sm font-semibold text-pitch hover:underline"
      >
        ← Back to {pool.name}
      </Link>

      <header className="mt-4 rounded-3xl bg-pitch p-6 text-white shadow-[var(--shadow-md)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold">
            {split.roundLabel} · M{split.matchNo}
          </span>
          {split.points > 0 ? (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em]">
              {split.points} pts
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 font-display text-xl">
          <span className="flex items-center gap-2">
            <Flag code={split.homeCode} size={22} /> {split.homeName}
          </span>
          <span className="text-white/60">vs</span>
          <span className="flex items-center gap-2">
            <Flag code={split.awayCode} size={22} /> {split.awayName}
          </span>
        </div>
        {split.decided ? (
          <p className="mt-3 text-center text-sm text-white/80">
            Winner: <span className="font-bold text-gold">{split.winnerCode}</span>
          </p>
        ) : (
          <p className="mt-3 text-center text-sm text-white/70">Not yet decided</p>
        )}
      </header>

      <section className="mt-6">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Who the pool picked ({split.totalPicks}{" "}
          {split.totalPicks === 1 ? "entry" : "entries"})
        </h2>

        {split.shares.length === 0 ? (
          <p className="mt-2.5 rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
            No winner picks recorded for this match yet.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {split.shares.map((s) => {
              const correct = split.decided && s.isActualWinner;
              const wrong = split.decided && !s.isActualWinner;
              return (
                <li
                  key={s.code}
                  className={`rounded-2xl border bg-surface p-4 ${
                    correct
                      ? "border-pitch shadow-[var(--shadow-xs)]"
                      : "border-line shadow-[var(--shadow-xs)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Flag code={s.code} size={20} />
                    <span className={`font-semibold ${wrong ? "text-ink-3" : "text-ink"}`}>
                      {s.name}
                    </span>
                    {correct ? (
                      <span className="rounded-full bg-pitch-tint px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-pitch-dark">
                        ✓ Won
                      </span>
                    ) : null}
                    {!split.decided && s.isContestant ? (
                      <span className="rounded-full bg-surface-sunk px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        In match
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-right">
                      <span className="font-display text-lg tabular-nums text-ink">{s.pct}%</span>
                      <span className="text-xs text-ink-3"> · {s.count}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunk">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${maxCount ? (s.count / maxCount) * 100 : 0}%`,
                        background: correct ? "var(--pitch)" : "var(--line)",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-ink-3">{s.entryLabels.join(", ")}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
