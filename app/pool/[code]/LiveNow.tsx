import Link from "next/link";
import type { MatchCenterRow, MatchCenterSide } from "@/lib/pool/match-center";
import { Flag } from "./Flag";
import { VenueLine } from "./VenueLine";
import { roundLabel } from "@/lib/pool/rounds";

// Same chromatic round sweep as the bracket / match center (group green → gold final).
const ROUND_ACCENT: Record<string, string> = {
  GROUP: "var(--pitch)",
  R32: "var(--round-r32)",
  R16: "var(--round-r16)",
  QF: "var(--round-qf)",
  SF: "var(--round-sf)",
  BRONZE: "var(--gold-dark)",
  FINAL: "var(--round-final)",
};

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
      Live
    </span>
  );
}

function Side({ side, isLeading }: { side: MatchCenterSide; isLeading: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Flag code={side.code} size={24} />
      <span className={`flex-1 truncate ${isLeading ? "font-bold text-ink" : "font-medium text-ink-2"}`}>
        {side.name}
        {side.code ? <span className="ml-1.5 font-mono text-[10px] text-ink-3">{side.code}</span> : null}
      </span>
      <span className="font-mono text-2xl font-bold tabular-nums text-ink">{side.score ?? 0}</span>
    </div>
  );
}

function LiveCard({ row, code }: { row: MatchCenterRow; code: string }) {
  const accent = ROUND_ACCENT[row.roundCode] ?? "var(--line)";
  const h = row.home.score ?? 0;
  const a = row.away.score ?? 0;
  return (
    <Link
      href={`/pool/${code}/matches/${row.matchNo}`}
      className="block rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)] transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          {roundLabel(row.roundCode)}
        </span>
        <LiveBadge />
      </div>
      <Side side={row.home} isLeading={h > a} />
      <div className="my-0.5 h-px bg-line-soft" />
      <Side side={row.away} isLeading={a > h} />
      {row.yourPick ? (
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-pitch-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-pitch-dark">
            Your pick: {row.yourPick.name}
          </span>
        </div>
      ) : null}
      <div className="mt-2">
        <VenueLine venue={row.venue} city={row.city} cityToken={row.cityToken} />
      </div>
    </Link>
  );
}

// Live scorecard surfaced at the top of Home while matches are in progress.
// Auto-refreshes via the layout's PoolRealtime (router.refresh on pool_events).
export function LiveNow({ rows, code }: { rows: MatchCenterRow[]; code: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2" aria-live="polite" aria-label="Live matches">
      <h2 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        <span className="h-1.5 w-1.5 rounded-full bg-live [animation:live-pulse_1.4s_ease-out_infinite]" />
        Live now
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <LiveCard key={row.matchNo} row={row} code={code} />
        ))}
      </div>
    </section>
  );
}
