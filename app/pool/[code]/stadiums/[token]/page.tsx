import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { formatKickoff, formatMatchDate } from "@/lib/pool/format";
import { getStadium, type StadiumMatch } from "@/lib/pool/stadiums";

export const dynamic = "force-dynamic";

// Group the (already kickoff-sorted) matches into consecutive same-date runs.
// Matches with no kickoff fall under a "Date TBD" heading at the end.
function groupByDate(matches: StadiumMatch[]): { date: string; matches: StadiumMatch[] }[] {
  const groups: { date: string; matches: StadiumMatch[] }[] = [];
  for (const m of matches) {
    const date = m.kickoff ? formatMatchDate(m.kickoff) : "Date TBD";
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.matches.push(m);
    else groups.push({ date, matches: [m] });
  }
  return groups;
}

export default async function StadiumPage({
  params,
}: {
  params: Promise<{ code: string; token: string }>;
}) {
  const { code, token } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const stadium = getStadium(token);
  if (!stadium) notFound();

  const days = groupByDate(stadium.matches);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link
          href={`/pool/${code}/stadiums`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 transition-colors hover:text-ink"
        >
          ← All stadiums
        </Link>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: `var(--city-${stadium.token})` }}
          />
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
            {stadium.city}
          </p>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink">{stadium.venue}</h1>
        <p className="text-sm text-ink-3">
          {stadium.matches.length} {stadium.matches.length === 1 ? "game" : "games"}
        </p>
      </header>

      <div className="space-y-4">
        {days.map((day) => (
          <section key={day.date}>
            <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
              {day.date}
            </h2>
            <ul className="mt-2 space-y-2">
              {day.matches.map((m) => (
                <li
                  key={m.matchNo}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
                      {m.tag || m.round}
                    </span>
                    {m.kickoff ? (
                      <span className="font-mono text-[11px] text-ink-3">
                        {formatKickoff(m.kickoff)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[15px] text-ink">
                    <span className="font-semibold">{m.home}</span>
                    <span className="text-ink-4">vs</span>
                    <span className="font-semibold">{m.away}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
