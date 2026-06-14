// Renders "Venue · City" with the host-city accent. No-ops when data is absent.
const TOKEN_OVERRIDES: Record<string, string> = {
  "New York / New Jersey": "new-york-nj",
  "San Francisco Bay Area": "san-francisco",
};

function tokenFor(city: string): string {
  return TOKEN_OVERRIDES[city] ?? city.toLowerCase().replace(/\s+/g, "-");
}

export function VenueLine({ venue, city }: { venue: string | null; city: string | null }) {
  if (!venue || !city) return null;
  const token = tokenFor(city);
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: `var(--city-${token})` }}
        aria-hidden
      />
      <span className="truncate">
        {venue} <span className="text-ink-4">· {city}</span>
      </span>
    </div>
  );
}
