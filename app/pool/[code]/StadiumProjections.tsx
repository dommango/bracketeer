import { Flag } from "./Flag";
import { TeamLink } from "./TeamLink";
import { DISPLAY_TZ } from "@/lib/tz";
import type { StadiumProjection, R32SlotProjection } from "@/lib/pool/stadium-projection";

const pct = (p: number) => Math.round(p * 100);
const MAX_SHOWN = 3;

const DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: DISPLAY_TZ,
});

const dateLabel = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE.format(d);
};

// One R32 slot: its descriptor (e.g. "Runners-up Group A") and the teams most
// likely to fill it. A decided slot shows just its one team; otherwise the top
// few candidates with their projected share.
function SlotRow({ slot, code }: { slot: R32SlotProjection; code: string }) {
  const shown = slot.candidates.slice(0, MAX_SHOWN);

  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="w-28 shrink-0 text-[11px] text-ink-4">{slot.label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
        {shown.length === 0 ? (
          <span className="text-[12px] italic text-ink-4">TBD</span>
        ) : (
          shown.map((c) => (
            <TeamLink
              key={c.code}
              poolCode={code}
              code={c.code}
              className="flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <Flag code={c.code} size={15} />
              <span className={`text-[13px] ${slot.decided ? "font-semibold text-ink" : "text-ink-2"}`}>
                {c.code}
              </span>
              {!slot.decided ? <span className="font-mono text-[11px] text-ink-3">{pct(c.prob)}%</span> : null}
            </TeamLink>
          ))
        )}
      </div>
    </div>
  );
}

function StadiumCard({ p, code }: { p: StadiumProjection; code: string }) {
  const date = dateLabel(p.kickoff);
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-ink">{p.venue}</span>
        <span className="shrink-0 text-[11px] text-ink-4">
          {p.city}
          {date ? <span className="ml-1.5 font-mono">{date}</span> : null}
        </span>
      </div>
      <div className="mt-1 divide-y divide-line-soft">
        <SlotRow slot={p.a} code={code} />
        <SlotRow slot={p.b} code={code} />
      </div>
    </div>
  );
}

// "Road to the Round of 32" — for each R32 stadium, the teams most likely to play
// there, from current group standings plus live odds. Hidden once every slot is
// locked (the real bracket view takes over). Display-only projection.
export function StadiumProjections({ projections, code }: { projections: StadiumProjection[]; code: string }) {
  const open = projections.some((p) => !p.a.decided || !p.b.decided);
  if (!open) return null;

  return (
    <section>
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
        Road to the Round of 32
        <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
          projected from standings &amp; odds
        </span>
      </h2>
      <div className="mt-2.5 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line-soft shadow-[var(--shadow-xs)] sm:grid-cols-2">
        {projections.map((p) => (
          <div key={p.matchNo} className="bg-surface">
            <StadiumCard p={p} code={code} />
          </div>
        ))}
      </div>
    </section>
  );
}
