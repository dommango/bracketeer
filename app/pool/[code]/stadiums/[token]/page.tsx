import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getMatchCenter } from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { sortChrono } from "@/lib/pool/fixture-views";
import { getStadium } from "@/lib/pool/stadiums";
import { MatchCenter } from "../../MatchCenter";

export const dynamic = "force-dynamic";

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

  // Reuse the live Match-Center rows so this venue's games render as the same
  // scorecards used elsewhere (scores, status, your pick, odds) instead of a
  // bare list — one chronological list, not grouped by day.
  const sessionUser = await getSessionUser();
  const sections = await getMatchCenter(pool.id, sessionUser?.id ?? null);
  const rows = sections.flatMap((s) => s.matches).filter((m) => m.cityToken === token);
  const venueSection = [{ roundCode: "GROUP", label: "", matches: sortChrono(rows) }];

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link
          href={`/pool/${code}/matches?view=groups&fx=city`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 transition-colors hover:text-ink"
        >
          ← Back to venues
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

      <MatchCenter sections={venueSection} code={code} />
    </div>
  );
}
