// Optional SeatGeek price overlay. SeatGeek exposes stats.lowest_price per event,
// which we use to fill a price where Ticketmaster's priceRanges came back empty
// (common for WC2026 resale). Only called when SEATGEEK_CLIENT_ID is set.

import { env } from "@/lib/env";
import type { TicketEvent } from "@/lib/tickets/map";

export interface SeatgeekPrice extends TicketEvent {
  lowestPrice: number | null;
}

interface SgVenue {
  name?: string;
  city?: string;
}
interface SgEvent {
  datetime_utc?: string;
  venue?: SgVenue;
  stats?: { lowest_price?: number | null };
}
interface SgResponse {
  events?: SgEvent[];
}

const PER_PAGE = 100;
const MAX_PAGES = 5;

export async function fetchSeatgeekPrices(signal?: AbortSignal): Promise<SeatgeekPrice[]> {
  const out: SeatgeekPrice[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${env.SEATGEEK_API_BASE}/events` +
      `?client_id=${env.SEATGEEK_CLIENT_ID}` +
      `&q=${encodeURIComponent("FIFA World Cup")}` +
      `&datetime_utc.gte=2026-06-01&datetime_utc.lte=2026-07-31` +
      `&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) throw new Error(`SeatGeek responded ${res.status}`);
    const json = (await res.json()) as SgResponse;
    const events = json.events ?? [];
    for (const ev of events) {
      // SeatGeek's datetime_utc is normally a zone-less UTC wall time; append a
      // "Z" only when no zone designator is already present (don't corrupt an
      // offset form like ...+00:00 into an invalid date).
      const raw = ev.datetime_utc;
      const startUtc = raw ? (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`) : null;
      out.push({
        startUtc,
        venueName: ev.venue?.name ?? null,
        city: ev.venue?.city ?? null,
        lowestPrice: ev.stats?.lowest_price ?? null,
      });
    }
    if (events.length < PER_PAGE) break;
  }
  return out;
}
