// Renders "Venue · City" with the host-city accent. No-ops when data is absent.
export function VenueLine({ venue, city, cityToken }: { venue: string | null; city: string | null; cityToken: string | null }) {
  if (!venue || !city || !cityToken) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--city-${cityToken})` }} aria-hidden="true" />
      <span className="truncate">{venue} <span className="text-ink-4">· {city}</span></span>
    </div>
  );
}
