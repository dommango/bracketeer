import Link from "next/link";
import type { MoversResult } from "@/lib/pool/snapshots";

// "Biggest movers since the last update" banner. Renders nothing until there are
// two snapshot batches to compare and at least one entry actually moved.
export function Movers({ result, code }: { result: MoversResult; code: string }) {
  if (!result.movers.length) return null;

  return (
    <div className="rounded-2xl border border-gold bg-gold-tint p-4 shadow-[var(--shadow-xs)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-pitch-dark">
        📈 Biggest movers
      </p>
      <ul className="mt-2 space-y-1.5">
        {result.movers.map((m) => (
          <li key={m.entryId} className="flex items-center gap-2 text-sm">
            <Link
              href={`/pool/${code}/entry/${m.entryId}`}
              className="truncate font-semibold text-ink hover:underline"
            >
              {m.label}
            </Link>
            {m.deltaPoints > 0 ? (
              <span className="shrink-0 rounded-full bg-pitch-tint px-1.5 py-px text-[11px] font-bold tabular-nums text-pitch-dark">
                +{m.deltaPoints} pts
              </span>
            ) : null}
            {m.deltaRank !== 0 ? (
              <span
                className={`shrink-0 text-[11px] font-bold tabular-nums ${
                  m.deltaRank > 0 ? "text-pitch" : "text-ink-4"
                }`}
              >
                {m.deltaRank > 0 ? `▲ ${m.deltaRank}` : `▼ ${Math.abs(m.deltaRank)}`}
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-xs text-ink-3">now #{m.rank}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
