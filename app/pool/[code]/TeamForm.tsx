import type { getTeamStats } from "@/lib/pool/queries";
import { UpdatedAt } from "./UpdatedAt";

// A team's tournament form card (record, goals, clean sheets + a recent-results
// strip), shown on the team page. Presentational only — data is fetched by the
// caller. Renders nothing when the team-stats poll hasn't populated a row.
type Stats = Awaited<ReturnType<typeof getTeamStats>>;

// Colour the W/D/L pills of the form string, most recent last (as the provider sends).
function FormStrip({ form }: { form: string }) {
  const results = form.toUpperCase().split("").filter((c) => c === "W" || c === "D" || c === "L");
  if (results.length === 0) return null;
  const tone: Record<string, string> = {
    W: "bg-pitch text-white",
    D: "bg-line text-ink-2",
    L: "bg-red-500 text-white",
  };
  return (
    <div className="flex items-center gap-1">
      {results.slice(-6).map((r, i) => (
        <span
          key={i}
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${tone[r]}`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-display text-xl tabular-nums text-ink">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4">{label}</span>
    </div>
  );
}

export function TeamForm({ stats }: { stats: Stats }) {
  if (!stats) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Tournament form</h2>
        <UpdatedAt date={stats.fetchedAt} />
      </div>
      <div className="mt-2.5 space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink-2">
            {stats.wins}W–{stats.draws}D–{stats.losses}L
            <span className="ml-1.5 text-xs font-normal text-ink-4">in {stats.played}</span>
          </span>
          {stats.form ? <FormStrip form={stats.form} /> : null}
        </div>
        <div className="grid grid-cols-4 gap-2 border-t border-line-soft pt-3">
          <Stat label="For" value={stats.goalsFor} />
          <Stat label="Against" value={stats.goalsAgainst} />
          <Stat label="Clean sheets" value={stats.cleanSheets} />
          <Stat label="Blanked" value={stats.failedToScore} />
        </div>
      </div>
    </section>
  );
}
