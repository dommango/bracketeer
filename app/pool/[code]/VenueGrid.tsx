import Link from "next/link";
import { formatMatchDate } from "@/lib/pool/format";
import type { VenueCard } from "@/lib/pool/fixture-views";

// Grid of host-venue cards (the "By City" fixture view). Each card drills into
// the per-venue schedule page, which shows that venue's full cross-stage slate.
// Links resolve under `basePath` (e.g. /challenge/md3) or the pool path from `code`.
export function VenueGrid({
  code,
  basePath,
  venues,
}: {
  code?: string;
  basePath?: string;
  venues: VenueCard[];
}) {
  const base = basePath ?? `/pool/${code}`;
  if (venues.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-3">
        No venues yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {venues.map((v) => (
        <Link
          key={v.token}
          href={`${base}/stadiums/${v.token}`}
          className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-4"
        >
          {/* City-accent rail down the left edge. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1"
            style={{ background: `var(--city-${v.token})` }}
          />
          <div className="flex items-center gap-2 pl-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: `var(--city-${v.token})` }}
            />
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{v.city}</p>
          </div>
          <h2 className="pl-1.5 font-display text-lg leading-tight text-ink">{v.venue}</h2>
          <p className="pl-1.5 text-[13px] text-ink-3">
            {v.count} {v.count === 1 ? "game" : "games"}
            {v.firstKickoff ? (
              <span className="text-ink-4"> · from {formatMatchDate(v.firstKickoff)}</span>
            ) : null}
          </p>
        </Link>
      ))}
    </div>
  );
}
