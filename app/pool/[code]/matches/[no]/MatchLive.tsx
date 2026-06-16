import { type TimelineItem, type StatBar, teamScoreboardLines } from "@/lib/pool/match-live";
import { Flag } from "../../Flag";

const SECTION_LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

// Inline scorers + cards for one team, shown directly under its scoreboard row.
// Goals are grouped per scorer ("Messi 23', 67'"); own goals carry an (OG) marker
// and missed penalties are excluded (they're not goals). Cards list player + minute.
// Reads the same timeline the full "Match events" rail below already uses.
export function TeamScorers({
  timeline,
  side,
}: {
  timeline: TimelineItem[];
  side: "home" | "away";
}) {
  const { scorers, cards } = teamScoreboardLines(timeline, side);
  if (scorers.length === 0 && cards.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 pb-2 pl-10 text-[12px]">
      {scorers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span aria-hidden className="text-[11px] leading-none">
            {"⚽"}
          </span>
          {scorers.map((s) => (
            <span key={s.label} className="text-ink-2">
              {s.label} <span className="font-mono text-ink-3">{s.minutes.join(", ")}</span>
            </span>
          ))}
        </div>
      ) : null}
      {cards.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {cards.map((c, i) => (
            <span key={`${c.sortKey}-${i}`} className="inline-flex items-center gap-1">
              <span aria-hidden className="text-[11px] leading-none">
                {c.icon}
              </span>
              <span className="text-ink-2">{c.player ?? c.teamCode}</span>
              <span className="font-mono text-ink-3">{c.minuteLabel}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Goal & card timeline. Home events hang left, away events right, around a
// central minute marker — the familiar broadcast match-event rail.
export function MatchTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className={`mb-2 ${SECTION_LABEL}`}>Match events</h3>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((it, i) => {
          const home = it.side === "home";
          return (
            <li
              key={`${it.sortKey}-${it.type}-${it.teamCode}-${i}`}
              className={`flex items-center gap-2 border-b border-line-soft px-3 py-2 text-sm last:border-b-0 ${
                home ? "flex-row" : "flex-row-reverse text-right"
              }`}
            >
              <span className="shrink-0 text-base leading-none">{it.icon}</span>
              <span className={`flex min-w-0 flex-1 flex-col ${home ? "items-start" : "items-end"}`}>
                <span className="truncate font-semibold text-ink">{it.player ?? it.teamCode}</span>
                {it.note ? <span className="truncate text-[11px] text-ink-3">{it.note}</span> : null}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-ink-3">{it.minuteLabel}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Paired team stats. Each row is a single bar split home (pitch) vs away
// (r16-violet), with the raw values flanking the centered label.
export function MatchStatsBars({
  bars,
  homeCode,
  awayCode,
}: {
  bars: StatBar[];
  homeCode: string | null;
  awayCode: string | null;
}) {
  if (bars.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className={SECTION_LABEL}>Team stats</h3>
        <span className="flex items-center gap-2 text-[11px] text-ink-3">
          <Flag code={homeCode} size={14} />
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--round-r16)" }} />
          <Flag code={awayCode} size={14} />
        </span>
      </div>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        {bars.map((b) => (
          <div key={b.key}>
            <div className="mb-1 flex items-center justify-between text-sm font-mono tabular-nums text-ink">
              <span>{b.home}{b.suffix}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                {b.label}
              </span>
              <span>{b.away}{b.suffix}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-sunk">
              <div className="h-full" style={{ width: `${b.homePct}%`, background: "var(--pitch)" }} />
              <div className="h-full flex-1" style={{ background: "var(--round-r16)" }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
