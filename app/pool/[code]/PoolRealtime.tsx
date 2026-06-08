"use client";

import { useRouter } from "next/navigation";
import { usePoolStream } from "./usePoolStream";

// Invisible component: refreshes the server-rendered leaderboard + bracket when a
// result lands (or on the periodic poll fallback).
export function PoolRealtime({ poolId }: { poolId: string }) {
  const router = useRouter();
  usePoolStream(poolId, (signal) => {
    if (signal === "chat") return;
    router.refresh();
  });
  return null;
}
