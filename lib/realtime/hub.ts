// Realtime fan-out hub. One shared Postgres LISTEN connection for the whole
// process feeds every open SSE stream, instead of one pg connection per client.
// A subscriber is just an in-memory callback, so thousands can share the one
// LISTEN. Producers emit via notifyPool() (pg_notify); the hub receives each
// event once and dispatches it to the subscribers for that pool.
//
// Note on delivery: Postgres does not buffer NOTIFY for a disconnected listener,
// so events fired during a reconnect gap are lost. That's acceptable here because
// usePoolStream also polls as a fallback — clients refetch and self-heal.

import { Client } from "pg";
import { POOL_EVENTS_CHANNEL, type PoolEvent } from "./events";

export interface RealtimeMessage {
  type: string;
  at: string;
}

export interface Subscriber {
  poolId: string;
  send: (msg: RealtimeMessage) => void;
}

// The slice of pg.Client the hub uses — narrowed so a fake can be injected in tests.
export interface ListenClient {
  connect(): Promise<void>;
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
  on(event: "notification", cb: (msg: { payload?: string }) => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  on(event: "end", cb: () => void): void;
}

export type ClientFactory = () => ListenClient;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export class RealtimeHub {
  private subscribers = new Set<Subscriber>();
  private client: ListenClient | null = null;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  constructor(private readonly createClient: ClientFactory) {}

  async add(sub: Subscriber): Promise<void> {
    this.subscribers.add(sub);
    await this.ensureListening();
  }

  remove(sub: Subscriber): void {
    this.subscribers.delete(sub);
    // The shared client stays open at zero subscribers — it's a single cheap
    // connection, and keeping it avoids connect/teardown churn between bursts.
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }

  // Single-flight: concurrent callers share one in-flight connect, and a settled
  // connect clears `connecting` before anything else runs, so there's never more
  // than one Client being established at a time.
  private ensureListening(): Promise<void> {
    if (this.client) return Promise.resolve();
    if (!this.connecting) {
      this.connecting = this.connect().then(
        () => {
          this.reconnectAttempts = 0;
          this.connecting = null;
        },
        (err) => {
          this.connecting = null;
          this.scheduleReconnect();
          throw err;
        },
      );
    }
    return this.connecting;
  }

  private async connect(): Promise<void> {
    const client = this.createClient();
    client.on("notification", (msg) => this.dispatch(msg.payload));
    client.on("error", (err) => {
      console.error("realtime hub pg error:", err);
      this.handleDrop(client);
    });
    client.on("end", () => this.handleDrop(client));

    try {
      await client.connect();
      // Channel name is a fixed identifier (not user input) — safe to inline.
      await client.query(`LISTEN ${POOL_EVENTS_CHANNEL}`);
    } catch (err) {
      // Don't leak a half-open connection if LISTEN (or connect) failed.
      try {
        await client.end();
      } catch {
        /* already gone */
      }
      throw err;
    }
    this.client = client;
  }

  // React only to a drop of the *active* client (ignores duplicate end+error for
  // the same client, and stale events from a client we already replaced).
  private handleDrop(dropped: ListenClient): void {
    if (this.client !== dropped) return;
    this.client = null;
    this.scheduleReconnect();
  }

  // Keep retrying with capped exponential backoff for as long as anyone is
  // listening, so a transient DB blip can't permanently wedge delivery. At zero
  // subscribers we stop and let the next add() reconnect lazily.
  private scheduleReconnect(): void {
    if (this.client || this.connecting || this.reconnectTimer) return;
    if (this.subscribers.size === 0) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureListening().catch((err) => {
        console.error("realtime hub reconnect failed:", err);
      });
    }, delay);
  }

  private dispatch(payload: string | undefined): void {
    if (!payload) return;
    let event: PoolEvent;
    try {
      event = JSON.parse(payload) as PoolEvent;
    } catch {
      return; // ignore malformed payloads
    }
    // Collect dead subscribers and remove them after iterating, never during.
    const dead: Subscriber[] = [];
    for (const sub of this.subscribers) {
      if (sub.poolId !== event.poolId) continue;
      try {
        sub.send({ type: event.type, at: event.at });
      } catch {
        dead.push(sub);
      }
    }
    for (const sub of dead) this.subscribers.delete(sub);
  }
}

// Read the connection string directly (rather than the validated env module) so
// importing the hub never triggers env validation — keeps it unit-testable.
const defaultFactory: ClientFactory = () =>
  new Client({ connectionString: process.env.DATABASE_URL }) as unknown as ListenClient;

// Reuse one hub across hot-reloads so dev doesn't accumulate LISTEN clients.
const globalForHub = globalThis as unknown as { realtimeHub?: RealtimeHub };
export const realtimeHub: RealtimeHub = globalForHub.realtimeHub ?? new RealtimeHub(defaultFactory);
if (process.env.NODE_ENV !== "production") globalForHub.realtimeHub = realtimeHub;
