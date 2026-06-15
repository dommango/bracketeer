import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { formatMatchDate } from "@/lib/pool/format";
import { buildStadiums } from "@/lib/pool/stadiums";

// Static schedule data, but resolved per-pool so the route shares the pool shell.
export const dynamic = "force-dynamic";

export default async function StadiumsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const stadiums = buildStadiums();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl text-ink">Stadiums</h1>
        <p className="mt-1 text-sm text-ink-3">
          Every fixture, grouped by host venue.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stadiums.map((s) => {
          const first = s.matches[0]?.kickoff ?? null;
          return (
            <Link
              key={s.token}
              href={`/pool/${code}/stadiums/${s.token}`}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-4"
            >
              {/* City-accent rail down the left edge. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: `var(--city-${s.token})` }}
              />
              <div className="flex items-center gap-2 pl-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: `var(--city-${s.token})` }}
                />
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
                  {s.city}
                </p>
              </div>
              <h2 className="pl-1.5 font-display text-lg leading-tight text-ink">
                {s.venue}
              </h2>
              <p className="pl-1.5 text-[13px] text-ink-3">
                {s.matches.length} {s.matches.length === 1 ? "game" : "games"}
                {first ? <span className="text-ink-4"> · from {formatMatchDate(first)}</span> : null}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
