import { Flag } from "./Flag";
import type { ChampionshipOdd } from "@/lib/pool/queries";

// Tournament-winner futures: the market's implied "champion %" per team, highest
// first, with a proportional bar. Server-rendered; hidden when no data exists.
export function ChampionshipOdds({ odds }: { odds: ChampionshipOdd[] }) {
  if (odds.length === 0) return null;
  const top = odds[0]?.winProb ?? 1; // scale bars relative to the favorite

  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Title odds
      </h2>
      <p className="mt-1 px-1 text-[11px] text-ink-4">
        Market-implied chance of winning the tournament.
      </p>
      <div className="mt-2.5 space-y-1.5 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-xs)]">
        {odds.map((o) => {
          const pct = o.winProb * 100;
          return (
            <div key={o.teamCode} className="flex items-center gap-2.5">
              <Flag code={o.teamCode} size={18} />
              <span className="w-9 shrink-0 font-mono text-xs font-semibold text-ink-2">
                {o.teamCode}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{o.name}</span>
              <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunk sm:block">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(o.winProb / top) * 100}%`, background: "var(--pitch)" }}
                />
              </div>
              <span className="w-11 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-pitch-dark">
                {pct >= 9.5 ? Math.round(pct) : pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
