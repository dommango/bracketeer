import type { PoolProjection, PoolProjectionRow } from "@/lib/pool/queries";
import { UpdatedAt } from "./UpdatedAt";

// Round a projected total for display: one decimal, but drop a trailing ".0".
function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
}

// Rank movement from the current official standing to the projected finish.
function Movement({ row }: { row: PoolProjectionRow }) {
  const delta = row.currentRank - row.projectedRank; // >0 ⇒ climbing
  if (delta === 0) {
    return <span className="font-mono text-[11px] text-ink-4" title="No projected change">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className="font-mono text-[11px] font-semibold tabular-nums"
      style={{ color: up ? "var(--positive)" : "var(--negative)" }}
      title={`Projected ${up ? "up" : "down"} ${Math.abs(delta)} from #${row.currentRank}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

// Display-only probabilistic projection of the final standings: each entry's
// expected remaining knockout points (from champion + match odds) added to its
// real scored total, re-ranked. Never part of anyone's actual score. Renders
// nothing when the odds integration hasn't populated a usable market.
export function ProjectedFinish({
  projection,
  youUserId,
}: {
  projection: PoolProjection;
  youUserId?: string | null;
}) {
  if (!projection.hasData || projection.rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Projected finish</h3>
        <UpdatedAt date={projection.fetchedAt} />
      </div>
      <p className="mt-1 text-[13px] leading-snug text-ink-3">
        Expected final standings from championship &amp; match odds — each entry&apos;s real total
        plus its expected remaining knockout points. For fun; it never changes your actual score.
      </p>
      <ol className="mt-3 space-y-1">
        {projection.rows.map((row) => {
          const isYou = Boolean(youUserId && row.userId === youUserId);
          return (
            <li
              key={row.entryId}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-1.5 ${
                isYou ? "bg-pitch-tint" : ""
              }`}
            >
              <span className="w-6 shrink-0 text-center font-display text-base text-ink-3 tabular-nums">
                {row.projectedRank}
              </span>
              <span className="w-8 shrink-0 text-center">
                <Movement row={row} />
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink">{row.label}</span>
                {isYou ? (
                  <span className="rounded-full bg-surface px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-pitch-dark">
                    You
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="font-display text-base tabular-nums text-ink">
                  {fmt(row.projectedTotal)}
                </span>
                <span className="ml-1 font-mono text-[11px] tabular-nums text-ink-4">
                  {row.actualPoints} now
                  {row.expectedRemaining > 0 ? ` · +${fmt(row.expectedRemaining)}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
