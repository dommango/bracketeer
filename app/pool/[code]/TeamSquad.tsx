import type { getSquad } from "@/lib/pool/queries";

// A team's roster, grouped by position (the poller pre-sorts GK → DEF → MID → FWD).
// Presentational only; renders nothing until the squads poll has data. Player names
// aren't linked — the player pages are keyed by the scoring-board spelling, which the
// squad list doesn't share, so a link would often 404.
type Member = Awaited<ReturnType<typeof getSquad>>[number];

const GROUPS: { key: string; label: string }[] = [
  { key: "Goalkeeper", label: "Goalkeepers" },
  { key: "Defender", label: "Defenders" },
  { key: "Midfielder", label: "Midfielders" },
  { key: "Attacker", label: "Forwards" },
];

function Group({ label, members }: { label: string; members: Member[] }) {
  if (members.length === 0) return null;
  return (
    <div>
      <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">{label}</p>
      <ul className="divide-y divide-line-soft">
        {members.map((m, i) => (
          <li key={`${m.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 shrink-0 text-center font-mono text-xs font-semibold text-ink-3">
              {m.number ?? "–"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.name}</span>
            {m.age != null ? <span className="shrink-0 text-[11px] text-ink-4">{m.age}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamSquad({ squad }: { squad: Member[] }) {
  if (squad.length === 0) return null;
  // Anything with an unrecognized position falls into a trailing "Squad" group.
  const known = new Set(GROUPS.map((g) => g.key));
  const other = squad.filter((m) => m.position == null || !known.has(m.position));
  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Squad</h2>
      <div className="mt-2.5 overflow-hidden rounded-2xl border border-line bg-surface">
        {GROUPS.map((g) => (
          <Group key={g.key} label={g.label} members={squad.filter((m) => m.position === g.key)} />
        ))}
        <Group label="Squad" members={other} />
      </div>
    </section>
  );
}
