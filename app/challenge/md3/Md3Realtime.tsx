"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Invisible component: refreshes the server-rendered Match Day Pickem board when a
// result lands, so the live leaderboard moves at the end of each match. Subscribes
// to the public challenge SSE stream and re-renders on every event; a periodic poll
// covers the gap when a reverse proxy silently drops SSE (same pattern as pools).
// The fallback interval is longer than the pool pages' 15s: SSE carries the live
// update, and this board is public, so the idle full-page refetch is kept light.
export function Md3Realtime({ pollMs = 30000 }: { pollMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/challenge/md3/stream");
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { type?: string };
          // Ignore the "hello"/"error" control frames; refresh on real events.
          if (data?.type === "result" || data?.type === "leaderboard") router.refresh();
        } catch {
          /* ignore malformed frames (e.g. keep-alive comments) */
        }
      };
      es.onerror = () => {
        /* EventSource reconnects on its own; the poll below covers the gap */
      };
    } catch {
      /* EventSource unavailable — rely entirely on polling */
    }

    const interval = setInterval(() => router.refresh(), pollMs);
    return () => {
      clearInterval(interval);
      es?.close();
    };
  }, [router, pollMs]);

  return null;
}
