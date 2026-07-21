import Link from "next/link";
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

// A compact "moved at the placement-credit cutover" chip: how many points the
// entry gained and how many places it climbed/slipped. Neutral tint so it reads
// as informational, not a live score. See lib/pool/cutover.ts.
function CutoverChip({ move }: { move: { rankDelta: number; pointsDelta: number } }) {
  if (move.pointsDelta === 0 && move.rankDelta === 0) return null;
  const rank =
    move.rankDelta > 0 ? `▲${move.rankDelta}` : move.rankDelta < 0 ? `▼${-move.rankDelta}` : "±0";
  return (
    <span
      className="rounded-full border border-gold/50 bg-gold-tint px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-2"
      title="Change when the pool adopted placement-agnostic knockout scoring"
    >
      Rule change {rank} · +{move.pointsDelta}
    </span>
  );
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
  code,
  linkBase,
  showMedals = false,
  compact = false,
  showLiveNote = true,
}: {
  rows: LeaderboardRow[];
  youUserId?: string | null;
  // When provided, each row links to that entry's player profile under this pool.
  code?: string;
  // An explicit link base for the per-entry detail page (e.g. "/challenge/md3/u").
  // Each row links to `${linkBase}/${entryId}`. Takes precedence over `code`; lets
  // the challenge boards reuse this component while pointing at their own routes.
  linkBase?: string;
  // Medals only make sense once standings settle — shown after the group stage.
  showMedals?: boolean;
  // Tighter rows with the per-category point badges hidden — for the Home preview.
  compact?: boolean;
  // The "live points stay dynamic until the group stage settles" note is about
  // full-bracket projected knockout points. Boards where it doesn't apply (e.g.
  // the Match Day Pickem scoreline game) opt out.
  showLiveNote?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">
        No entries yet.
      </p>
    );
  }

  const hasLive = showLiveNote && rows.some((r) => r.projected);

  return (
    <>
      {hasLive ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-gold/40 bg-gold-tint px-4 py-3">
          <span aria-hidden className="mt-px text-base leading-none">⚡</span>
          <p className="text-[13px] leading-snug text-ink-2">
            <span className="font-bold text-ink">Live points stay dynamic</span> until the group
            stage is complete — totals shift as in-progress matches and group standings settle.
          </p>
        </div>
      ) : null}
      <ol className={compact ? "space-y-1.5" : "space-y-2"}>
      {rows.map((row) => {
        const b = (row.breakdown ?? {}) as Record<string, number>;
        const isYou = Boolean(youUserId && row.userId === youUserId);
        const m = showMedals ? medal(row.rank) : "";
        const content = (
          <>
            <div className="flex items-center gap-3">
              <span
                aria-label={`Rank ${row.rank}`}
                className={`w-8 shrink-0 text-center font-display ${
                  m ? "text-[22px]" : "text-lg text-ink-3"
                }`}
              >
                <span aria-hidden>{m || row.rank}</span>
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
                {/* Show the live total (official + provisional) so the number matches
                    both the live ranking and the Home standing card; the badge breaks
                    out how much of it is still provisional. */}
                <span className="font-display text-[22px] tabular-nums text-ink">
                  {row.total + (row.projected ?? 0)}
                </span>
                <span className="text-xs text-ink-3"> pts</span>
              </span>
            </div>
            {compact ? null : (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[76px]">
                {CATEGORY_LABELS.filter(([k]) => (b[k] ?? 0) > 0).map(([k, label]) => (
                  <span
                    key={k}
                    className="rounded-full bg-pitch-tint px-2 py-0.5 text-[11px] font-semibold tabular-nums text-pitch-dark"
                  >
                    {label} {b[k]}
                  </span>
                ))}
                {row.cutover ? <CutoverChip move={row.cutover} /> : null}
              </div>
            )}
          </>
        );
        return (
          <li
            key={row.entryId}
            className={`rounded-2xl border bg-surface ${
              isYou
                ? "border-pitch shadow-[0_0_0_2px_var(--pitch-tint)]"
                : "border-line shadow-[var(--shadow-xs)]"
            }`}
          >
            {linkBase || code ? (
              <Link
                href={linkBase ? `${linkBase}/${row.entryId}` : `/pool/${code}/u/${row.entryId}`}
                className={`block rounded-2xl transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch ${
                  compact ? "p-3" : "p-4"
                }`}
              >
                {content}
              </Link>
            ) : (
              <div className={compact ? "p-3" : "p-4"}>{content}</div>
            )}
          </li>
        );
      })}
      </ol>
    </>
  );
}
