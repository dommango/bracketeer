"use client";

import { useEffect, useRef } from "react";

export type StreamSignal = "leaderboard" | "result" | "chat" | "poll";

// Subscribe to a pool's SSE stream and invoke onSignal for each server event.
// A periodic "poll" signal is always emitted as a fallback, because reverse
// proxies (e.g. Railway) can silently drop SSE — consumers treat "poll" as
// "refresh just in case". The browser auto-reconnects a dropped EventSource.
export function usePoolStream(
  poolId: string,
  onSignal: (signal: StreamSignal) => void,
  pollMs = 15000,
): void {
  const cb = useRef(onSignal);
  useEffect(() => {
    cb.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/pool/${poolId}/stream`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { type?: StreamSignal };
          if (data?.type) cb.current(data.type);
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

    const interval = setInterval(() => cb.current("poll"), pollMs);
    return () => {
      clearInterval(interval);
      es?.close();
    };
  }, [poolId, pollMs]);
}
