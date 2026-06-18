import { Flag } from "./Flag";
import { teamColor, DRAW_FILL } from "@/lib/teams/colors";
import { DISPLAY_TZ } from "@/lib/tz";
import type { UpsetRow } from "@/lib/odds/upset";

const pct = (p: number) => Math.round(p * 100);

const KICKOFF = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DISPLAY_TZ,
});

const kickoffLabel = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : KICKOFF.format(d);
};

// One upcoming, upset-prone match: favorite vs underdog with their win-shares and
// a tag when the viewer has a stake in either side.
function RadarRow({ row }: { row: UpsetRow }) {
  const ko = kickoffLabel(row.scheduledAt);
  const stakeName = row.stake ? (row.stake.side === "favorite" ? row.favorite.name : row.underdog.name) : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span
        className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={
          row.kind === "tossup"
            ? { background: "var(--warning-tint)", color: "var(--warning)" }
            : { background: "var(--gold-tint)", color: "var(--gold-dark)" }
        }
      >
        {row.kind === "tossup" ? "Toss-up" : "Upset Watch"}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          <Flag code={row.favorite.code} size={16} />
          <span className="truncate font-semibold text-ink">{row.favorite.name}</span>
          <span className="font-mono text-[11px] text-ink-3">{pct(row.favorite.winProb)}%</span>
          <span className="px-0.5 text-ink-4">v</span>
          <Flag code={row.underdog.code} size={16} />
          <span className="truncate text-ink-2">{row.underdog.name}</span>
          <span className="font-mono text-[11px] text-ink-3">{pct(row.underdog.winProb)}%</span>
        </div>
        {ko || stakeName ? (
          <p className="mt-0.5 text-[11px] text-ink-4">
            {ko ? <span>{ko}</span> : null}
            {ko && stakeName ? <span className="px-1">·</span> : null}
            {stakeName ? (
              <span style={{ color: teamColor(row.stake!.code) }} className="font-semibold">
                Your pick {stakeName} {row.stake!.side === "favorite" ? "could slip" : "could shock"}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Three-segment share bar: favorite · draw · underdog — draw textured-gray
          in the middle, matching the win-probability bars elsewhere. */}
      <div className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-sunk sm:flex">
        <span style={{ width: `${pct(row.favorite.winProb)}%`, background: teamColor(row.favorite.code) }} />
        <span style={{ width: `${pct(row.drawProb)}%`, background: DRAW_FILL }} />
        <span style={{ width: `${pct(row.underdog.winProb)}%`, background: teamColor(row.underdog.code) }} />
      </div>
    </div>
  );
}

// "Upset watch" — the upcoming matches most likely to defy the bookmakers'
// favorite, personalised to the teams the viewer backed. Hidden when empty.
export function UpsetRadar({ rows }: { rows: UpsetRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Upset watch
        <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
          from the betting odds
        </span>
      </h2>
      <div className="mt-2.5 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-xs)]">
        {rows.map((row) => (
          <RadarRow key={row.matchNo} row={row} />
        ))}
      </div>
    </section>
  );
}
