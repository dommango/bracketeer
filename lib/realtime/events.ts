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
