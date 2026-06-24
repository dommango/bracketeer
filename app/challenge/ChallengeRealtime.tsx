"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Lightweight realtime for the public challenge boards. The pool SSE pipeline is
// poolId-scoped end to end (notify payload, hub dispatch filter, membership-gated
// stream route) and challenges have no poolId, so instead of a new public stream
// we lean on the same periodic refresh the pool stream already uses as its
// fallback. The challenge pages are `dynamic = "force-dynamic"` and read live
// results / projection at request time, so a periodic router.refresh() keeps the
// score cards and live totals current — near-parity in feel with zero changes to
// the notify / stream / hub infrastructure.
export function ChallengeRealtime({ pollMs = 15000 }: { pollMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), pollMs);
    return () => clearInterval(interval);
  }, [router, pollMs]);
  return null;
}
