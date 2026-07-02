import type { DailyKnockoutView, DailyKnockoutFixtureVM } from "@/lib/pool/daily-knockout-view";
import type { Stage } from "@/lib/games/stage";
import { roundWeight } from "@/lib/games/daily-pickem/ladder";
import { Flag } from "@/app/pool/[code]/Flag";
import { WinProbBar } from "@/app/pool/[code]/WinProbBar";

// The knockout analogue of Md3PickBreakdown: a read-only, per-fixture breakdown of
// one entry's knockout predictions vs. the live/final results, with the points each
// pick earned (exact 5 · result + goal difference 3 · result 1 · +1 correct
// advancer). Server component.

const STAGE_ACCENT: Record<Stage, string> = {
  GROUP: "var(--pitch)",
  R32: "var(--pitch)",
  R16: "var(--gold-dark, #9a7b1f)",
  QF: "var(--gold-dark, #9a7b1f)",
  SF: "var(--live, #c0392b)",
  FINAL: "var(--live, #c0392b)",
};
const STAGE_LABEL: Record<Stage, string> = {
  GROUP: "Group",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  FINAL: "Final",
};

function kickoffLabel(iso: string | null): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string | null): string {
  if (!iso) return "To be scheduled";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-surface-sunk px-3 py-2 text-center">
      <p className="font-display text-xl tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">{label}</p>
    </div>
  );
}

function FixtureRow({ f }: { f: DailyKnockoutFixtureVM }) {
  const final = f.result?.final ?? false;
  const accent = STAGE_ACCENT[f.stage];
  return (
    <div
      className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-xs)]"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          {STAGE_LABEL[f.stage]}
        </span>
        {final ? (
          <span className="rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">
            Final
          </span>
        ) : (
          <span className="font-mono text-[11px] text-ink-3">
            {f.locked ? "Locked · " : ""}
            {kickoffLabel(f.kickoffISO)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{f.homeName}</span>
          {f.homeCode ? <Flag code={f.homeCode} size={22} /> : null}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-surface-sunk px-2.5 py-1 font-mono text-[15px] font-bold tabular-nums text-ink">
          {f.predHidden ? (
            <span
              className="text-[11px] font-semibold text-ink-3"
              title="Predictions reveal once the fixture kicks off"
            >
              🔒 kickoff
            </span>
          ) : f.pred ? (
            <>
              {f.pred.home}
              <span className="text-ink-4">–</span>
              {f.pred.away}
            </>
          ) : (
            <span className="text-ink-4">— · —</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-start gap-2">
          {f.awayCode ? <Flag code={f.awayCode} size={22} /> : null}
          <span className="truncate text-[15px] font-semibold text-ink">{f.awayName}</span>
        </span>
      </div>

      {!final && f.open ? (
        <WinProbBar odds={f.odds} homeCode={f.homeCode ?? ""} awayCode={f.awayCode ?? ""} />
      ) : null}

      {f.result ? (
        <div className="mt-2 flex items-center justify-center gap-2 text-[12px]">
          <span className="font-semibold text-ink-2">
            {final ? "Final" : "Live"} {f.result.home}–{f.result.away}
          </span>
          {f.points !== null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                f.points > 0 ? "bg-pitch-tint text-pitch-dark" : "bg-surface-sunk text-ink-3"
              }`}
            >
              +{f.points}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DailyKnockoutBreakdown({
  label,
  view,
  rank,
}: {
  label: string;
  view: DailyKnockoutView;
  rank?: number | null;
}) {
  const exact = view.fixtures.filter((f) => f.points === 5).length;
  const resultsRight = view.fixtures.filter((f) => (f.points ?? 0) >= 1).length;
  // The board ranks on the round-weighted ladder, so the headline total does too
  // (raw per-fixture points × the round multiplier), matching the shown rank.
  const ladderTotal = view.fixtures.reduce(
    (sum, f) => sum + (f.points ?? 0) * roundWeight(f.matchNo),
    0,
  );
  // Only seated fixtures are shown — an unresolved future fixture has no matchup yet.
  const shown = view.fixtures.filter((f) => f.open);

  const rows = shown.map((f, i) => {
    const day = dayLabel(f.kickoffISO);
    const showDay = i === 0 || day !== dayLabel(shown[i - 1].kickoffISO);
    return { f, day, showDay };
  });

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-xs)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              Knockout Pick&apos;em
            </p>
            <h1 className="mt-1 truncate font-display text-xl text-ink">{label}</h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-[28px] leading-none tabular-nums text-ink">
              {ladderTotal}
              <span className="ml-1 text-sm font-normal text-ink-3">pts</span>
            </p>
            {rank ? <p className="mt-1 font-mono text-xs tabular-nums text-ink-3">Rank {rank}</p> : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Exact" value={exact} />
          <Stat label="Right result" value={resultsRight} />
          <Stat label="Scored" value={view.scoredCount} />
        </div>
      </header>

      <ul className="space-y-2">
        {rows.map(({ f, day, showDay }) => (
          <li key={f.matchNo}>
            {showDay ? (
              <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">{day}</p>
            ) : null}
            <FixtureRow f={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}
