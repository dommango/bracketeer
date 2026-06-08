import type { LeaderboardRow } from "@/lib/pool/scoring";

const CATEGORY_LABELS: [string, string][] = [
  ["group", "Groups"],
  ["thirds", "3rd place"],
  ["r32", "R32"],
  ["r16", "R16"],
  ["qf", "QF"],
  ["sf", "SF"],
  ["final", "Final"],
  ["awards", "Awards"],
];

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
}

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-black/50">
        No entries yet.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const b = (row.breakdown ?? {}) as Record<string, number>;
        return (
          <li
            key={row.entryId}
            className={`rounded-2xl border bg-white p-4 ${
              row.rank === 1 ? "border-gold ring-1 ring-gold/40" : "border-black/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-center font-bold text-black/60">
                {medal(row.rank) || row.rank}
              </span>
              <span className="flex-1 font-semibold truncate">{row.label}</span>
              <span className="shrink-0 text-right">
                <span className="text-xl font-bold tabular-nums">{row.total}</span>
                <span className="text-black/40 text-xs"> pts</span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
              {CATEGORY_LABELS.filter(([k]) => (b[k] ?? 0) > 0).map(([k, label]) => (
                <span
                  key={k}
                  className="rounded-full bg-pitch/8 text-pitch-dark text-[11px] font-medium px-2 py-0.5"
                >
                  {label} {b[k]}
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
