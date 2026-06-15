// Ticketmaster Discovery API (v2) client. Lists WC2026 matches as events; we use
// it for the official buy link + (when present) a min price. Free API key, 5000
// calls/day. Paginates; only called when TICKETMASTER_API_KEY is set.

import { env } from "@/lib/env";

export interface TicketmasterEvent {
  startUtc: string | null;
  venueName: string | null;
  city: string | null;
  url: string | null;
  minPrice: number | null;
  currency: string | null;
}

interface TmVenue {
  name?: string;
  city?: { name?: string };
}
interface TmPriceRange {
  min?: number;
  currency?: string;
}
interface TmEvent {
  url?: string;
  dates?: { start?: { dateTime?: string } };
  _embedded?: { venues?: TmVenue[] };
  priceRanges?: TmPriceRange[];
}
interface TmResponse {
  _embedded?: { events?: TmEvent[] };
  page?: { totalPages?: number };
}

function parseEvent(ev: TmEvent): TicketmasterEvent {
  const venue = ev._embedded?.venues?.[0];
  // Require a positive price so a placeholder/zero range can't surface as "$0".
  const pr = ev.priceRanges?.find((p) => typeof p.min === "number" && p.min > 0);
  // Only keep an https buy link (defensive against a bad scheme; TM links are https).
  const url = ev.url && /^https:\/\//i.test(ev.url) ? ev.url : null;
  return {
    startUtc: ev.dates?.start?.dateTime ?? null,
    venueName: venue?.name ?? null,
    city: venue?.city?.name ?? null,
    url,
    minPrice: pr?.min ?? null,
    currency: pr?.currency ?? null,
  };
}

const MAX_PAGES = 5; // 199 × 5 ≈ 1000 events, well above the 104 fixtures

export async function fetchTicketmasterEvents(
  signal?: AbortSignal,
): Promise<TicketmasterEvent[]> {
  const out: TicketmasterEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${env.TICKETMASTER_API_BASE}/events.json` +
      `?apikey=${env.TICKETMASTER_API_KEY}` +
      `&keyword=${encodeURIComponent("FIFA World Cup 26")}` +
      `&classificationName=Sports` +
      `&size=199&page=${page}` +
      `&startDateTime=2026-06-01T00:00:00Z&endDateTime=2026-07-31T00:00:00Z`;
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) throw new Error(`Ticketmaster responded ${res.status}`);
    const json = (await res.json()) as TmResponse;
    const events = json._embedded?.events ?? [];
    for (const ev of events) out.push(parseEvent(ev));
    const totalPages = json.page?.totalPages ?? 1;
    if (events.length === 0 || page >= totalPages - 1) break;
  }
  return out;
}
