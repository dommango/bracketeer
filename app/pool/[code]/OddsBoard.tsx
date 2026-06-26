import Link from "next/link";
import { Flag } from "./Flag";
import { teamColor } from "@/lib/teams/colors";
import { UpdatedAt } from "./UpdatedAt";

// One unified pattern for every implied-probability market (title odds, Golden
// Boot odds, …): flag + name + team-colored bar scaled to the favorite + %.
// Generalizes the ChampionshipOdds / PoolAnalytics TallyRow idiom into one place.
export interface OddsBoardRow {
  key: string;
  code: string | null; // team code for flag + bar color (null = neutral, no flag)
  primary: string;
  secondary?: string | null; // small dim label (team code, etc.)
  winProb: number;
  href?: string; // makes the whole row a link (flat — safe to nest a flag <img>)
}

function pctLabel(pct: number): string {
  return pct >= 9.5 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
}

function Row({ row, top }: { row: OddsBoardRow; top: number }) {
  const pct = row.winProb * 100;
  const inner = (
    <>
      {row.code ? <Flag code={row.code} size={18} /> : <span className="w-[18px] shrink-0" />}
      {row.secondary ? (
        <span className="w-9 shrink-0 font-mono text-xs font-semibold text-ink-2">
          {row.secondary}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{row.primary}</span>
      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunk sm:block">
        <span
          className="block h-full rounded-full"
          style={{ width: `${(row.winProb / top) * 100}%`, background: teamColor(row.code) }}
        />
      </div>
      <span className="w-11 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-pitch-dark">
        {pctLabel(pct)}
      </span>
    </>
  );
  if (row.href) {
    return (
      <Link
        href={row.href}
        className="-mx-1 flex items-center gap-2.5 rounded-lg px-1 py-0.5 hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center gap-2.5">{inner}</div>;
}

export function OddsBoard({
  title,
  subtitle,
  rows,
  fetchedAt,
}: {
  title: string;
  subtitle?: string;
  rows: OddsBoardRow[];
  fetchedAt?: Date | null;
}) {
  if (rows.length === 0) return null;
  const top = rows[0]?.winProb || 1; // bars scale relative to the favorite

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{title}</h2>
        <UpdatedAt date={fetchedAt} />
      </div>
      {subtitle ? <p className="mt-1 px-1 text-[11px] text-ink-4">{subtitle}</p> : null}
      <div className="mt-2.5 space-y-1.5 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-xs)]">
        {rows.map((r) => (
          <Row key={r.key} row={r} top={top} />
        ))}
      </div>
    </section>
  );
}
