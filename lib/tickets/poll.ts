// Tickets poller: Ticketmaster supplies the event list + official buy link (and a
// price when present); SeatGeek optionally fills the price where Ticketmaster's
// was empty. Maps listings to internal matchNos and upserts MatchTickets. Safe
// no-op when TICKETMASTER_API_KEY is unset.

import { prisma } from "@/lib/db";
import { ticketsEnabled, seatgeekEnabled } from "@/lib/env";
import { fetchTicketmasterEvents } from "@/lib/tickets/client";
import { fetchSeatgeekPrices } from "@/lib/tickets/seatgeek";
import { resolveTicketMatchNo, wc2026Slots } from "@/lib/tickets/map";

export interface TicketsPollSummary {
  fetched: number;
  mapped: number;
  upserted: number;
  seatgeekFilled: number;
  unmatched: number;
}

// Bounds the whole paginated fetch (up to 5 sequential pages) per provider.
const FETCH_TIMEOUT_MS = 20_000;

const EMPTY: TicketsPollSummary = {
  fetched: 0,
  mapped: 0,
  upserted: 0,
  seatgeekFilled: 0,
  unmatched: 0,
};

export async function pollTickets(): Promise<TicketsPollSummary> {
  if (!ticketsEnabled) return EMPTY;

  const tournament = await prisma.tournament.findUnique({
    where: { slug: "wc2026" },
    select: { id: true },
  });
  if (!tournament) return EMPTY;

  const rows = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true, matchNo: true },
  });
  const idByMatchNo = new Map(rows.map((m) => [m.matchNo, m.id]));
  const slots = wc2026Slots();

  // 1) Optional SeatGeek overlay: matchNo → cheapest lowest_price.
  const sgPriceByMatch = new Map<number, number>();
  if (seatgeekEnabled) {
    try {
      const prices = await fetchSeatgeekPrices(AbortSignal.timeout(FETCH_TIMEOUT_MS));
      for (const p of prices) {
        if (p.lowestPrice == null) continue;
        const matchNo = resolveTicketMatchNo(p, slots);
        if (matchNo == null) continue;
        const prev = sgPriceByMatch.get(matchNo);
        if (prev == null || p.lowestPrice < prev) sgPriceByMatch.set(matchNo, p.lowestPrice);
      }
    } catch (err) {
      console.error("seatgeek overlay failed:", err);
    }
  }

  // 2) Ticketmaster listings → matchNo, keeping the cheapest price + a buy link.
  const events = await fetchTicketmasterEvents(AbortSignal.timeout(FETCH_TIMEOUT_MS));
  let unmatched = 0;
  const tmByMatch = new Map<
    number,
    { minPrice: number | null; currency: string | null; url: string | null }
  >();
  for (const ev of events) {
    const matchNo = resolveTicketMatchNo(ev, slots);
    if (matchNo == null) {
      unmatched++;
      continue;
    }
    const cur = tmByMatch.get(matchNo);
    if (!cur) {
      tmByMatch.set(matchNo, {
        minPrice: ev.minPrice,
        currency: ev.currency,
        url: ev.url,
      });
    } else {
      if (ev.minPrice != null && (cur.minPrice == null || ev.minPrice < cur.minPrice)) {
        cur.minPrice = ev.minPrice;
        cur.currency = ev.currency;
      }
      if (!cur.url && ev.url) cur.url = ev.url;
    }
  }

  let upserted = 0;
  let seatgeekFilled = 0;
  for (const [matchNo, tm] of tmByMatch) {
    const matchId = idByMatchNo.get(matchNo);
    if (!matchId) continue;
    const sg = sgPriceByMatch.get(matchNo);
    const minPrice = tm.minPrice ?? sg ?? null;
    const priceSource = tm.minPrice != null ? "ticketmaster" : sg != null ? "seatgeek" : null;
    const currency = tm.currency ?? (sg != null ? "USD" : null);
    if (tm.minPrice == null && sg != null) seatgeekFilled++;

    const data = {
      minPrice,
      currency,
      url: tm.url,
      priceSource,
      source: "ticketmaster",
      raw: tm as object,
      fetchedAt: new Date(),
    };
    await prisma.matchTickets.upsert({
      where: { matchId },
      update: data,
      create: { matchId, ...data },
    });
    upserted++;
  }

  return { fetched: events.length, mapped: tmByMatch.size, upserted, seatgeekFilled, unmatched };
}
