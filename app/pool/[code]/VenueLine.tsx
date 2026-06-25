import Link from "next/link";

// Renders "Venue · City" with the host-city accent. No-ops when data is absent.
// When a base resolves (`code` → that pool's stadium view, or an explicit
// `basePath` for non-pool callers like the public challenges) and the line isn't
// already nested in a card-link, it links to the stadium view for the city —
// stadium and city share the same token route — so a scorecard's venue is a way
// in to every game there.
export function VenueLine({
  venue,
  city,
  cityToken,
  code,
  basePath,
}: {
  venue: string | null;
  city: string | null;
  cityToken: string | null;
  code?: string;
  basePath?: string;
}) {
  if (!venue || !city || !cityToken) return null;
  const base = basePath ?? (code ? `/pool/${code}` : null);
  const inner = (
    <>
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: `var(--city-${cityToken})` }}
        aria-hidden="true"
      />
      <span className="truncate">
        {venue} <span className="text-ink-4">· {city}</span>
      </span>
    </>
  );
  if (base) {
    return (
      <Link
        href={`${base}/stadiums/${cityToken}`}
        className="inline-flex items-center gap-1.5 text-[11px] text-ink-3 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center gap-1.5 text-[11px] text-ink-3">{inner}</div>;
}
