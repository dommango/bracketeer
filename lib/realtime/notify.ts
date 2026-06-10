// Realtime fan-out via Postgres LISTEN/NOTIFY. Producers (import, result entry,
// chat) call notifyPool(); the SSE endpoint LISTENs on the same channel and
// forwards events to connected clients. Best-effort: a notify failure never
// breaks the operation that triggered it.

import { Pool } from "pg";
import { env } from "@/lib/env";
import { POOL_EVENTS_CHANNEL, type PoolEvent, type PoolEventType } from "./events";

export { POOL_EVENTS_CHANNEL, type PoolEvent, type PoolEventType } from "./events";

// A tiny dedicated pool, reused across hot reloads, just for emitting notifies.
const globalForPg = globalThis as unknown as { pgNotifyPool?: Pool };

const notifyPool_ =
  globalForPg.pgNotifyPool ?? new Pool({ connectionString: env.DATABASE_URL, max: 2 });

if (process.env.NODE_ENV !== "production") globalForPg.pgNotifyPool = notifyPool_;

// Emit a small event for a pool. The payload is intentionally tiny (well under
// Postgres' 8000-byte NOTIFY limit) — clients refetch the affected resource.
export async function notifyPool(poolId: string, type: PoolEventType): Promise<void> {
  const payload = JSON.stringify({ poolId, type, at: new Date().toISOString() } satisfies PoolEvent);
  try {
    await notifyPool_.query(`SELECT pg_notify($1, $2)`, [POOL_EVENTS_CHANNEL, payload]);
  } catch (err) {
    console.error("notifyPool failed:", err);
  }
}
