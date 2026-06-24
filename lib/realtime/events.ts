// Realtime event shape + channel name. Kept dependency-free (no pg, no env) so
// both the producer (notify.ts) and the consumer hub can import it without
// pulling in a database connection or env validation.

export const POOL_EVENTS_CHANNEL = "pool_events";

export type PoolEventType = "leaderboard" | "result" | "chat";

export interface PoolEvent {
  poolId: string;
  type: PoolEventType;
  at: string;
}

// Standalone challenge entries (poolId == null — e.g. the public Match Day Pickem
// board) live outside any pool, so they have no pool id to broadcast on. They
// share one tournament-scoped channel instead: the producer notifies this key
// when standalone entries rescore, and the public challenge stream subscribes to
// it. Reuses the PoolEvent.poolId field as an opaque routing key, so the hub and
// notify path stay unchanged.
export function standaloneChannelId(tournamentId: string): string {
  return `standalone:${tournamentId}`;
}
