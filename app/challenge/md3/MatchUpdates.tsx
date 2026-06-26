import type { MatchUpdate } from "@/lib/challenge/match-updates";

// The MD3 challenge's live match-updates feed — the no-chat analogue of the pool
// home's "Latest from chat" list. Mirrors that list styling; the lines are the
// same goal / red-card / full-time strings the poller posts to pool chat, rebuilt
// from MatchEvent + Result (see lib/challenge/match-updates.ts). Presentational:
// already newest-first, returns null when there's nothing live or final yet.
export function MatchUpdates({ updates }: { updates: MatchUpdate[] }) {
  if (updates.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Match updates
      </h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {updates.map((u) => (
          <li key={u.key} className="flex items-baseline gap-2 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-2">{u.line}</span>
            <span className="shrink-0 font-mono text-[10px] text-ink-4">{u.tag}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
