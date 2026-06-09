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

// Host-city accents with enough contrast to carry white avatar text.
const AVATAR_COLORS = [
  "var(--city-houston)",
  "var(--city-philadelphia)",
  "var(--city-guadalajara)",
  "var(--city-los-angeles)",
  "var(--city-atlanta)",
  "var(--city-vancouver)",
  "var(--city-monterrey)",
  "var(--city-kansas-city)",
  "var(--city-mexico-city)",
  "var(--city-san-francisco)",
  "var(--city-new-york-nj)",
  "var(--city-boston)",
];

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Leaderboard({
  rows,
  youUserId,
}: {
  rows: LeaderboardRow[];
  youUserId?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
        No entries yet.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const b = (row.breakdown ?? {}) as Record<string, number>;
        const isLeader = row.rank === 1;
        const isYou = Boolean(youUserId && row.userId === youUserId);
        const m = medal(row.rank);
        return (
          <li
            key={row.entryId}
            className={`rounded-2xl border bg-surface p-4 ${
              isLeader
                ? "border-gold shadow-[var(--shadow-ring-gold)]"
                : "border-line shadow-[var(--shadow-xs)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-8 shrink-0 text-center font-display ${
                  m ? "text-[22px]" : "text-lg text-ink-3"
                }`}
              >
                {m || row.rank}
              </span>
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[13px] text-white"
                style={{
                  background: avatarColor(row.entryId),
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                {initials(row.label)}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-semibold text-ink">{row.label}</span>
                {isYou ? (
                  <span className="rounded-full bg-pitch-tint px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-pitch-dark">
                    You
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="font-display text-[22px] tabular-nums text-ink">{row.total}</span>
                <span className="text-xs text-ink-3"> pts</span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 pl-[76px]">
              {CATEGORY_LABELS.filter(([k]) => (b[k] ?? 0) > 0).map(([k, label]) => (
                <span
                  key={k}
                  className="rounded-full bg-pitch-tint px-2 py-0.5 text-[11px] font-semibold tabular-nums text-pitch-dark"
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
