import { describe, it, expect, vi, afterEach } from "vitest";
import { RealtimeHub, type ListenClient, type RealtimeMessage } from "./hub";

class FakeClient implements ListenClient {
  private notif?: (m: { payload?: string }) => void;
  private errCb?: (err: Error) => void;
  private endCb?: () => void;
  ended = false;

  constructor(private opts: { failConnect?: boolean; failListen?: boolean } = {}) {}

  on(event: "notification", cb: (msg: { payload?: string }) => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  on(event: "end", cb: () => void): void;
  on(event: string, cb: (arg: never) => void): void {
    if (event === "notification") this.notif = cb as (m: { payload?: string }) => void;
    else if (event === "error") this.errCb = cb as (err: Error) => void;
    else if (event === "end") this.endCb = cb as () => void;
  }

  async connect(): Promise<void> {
    if (this.opts.failConnect) throw new Error("connect failed");
  }
  async query(): Promise<unknown> {
    if (this.opts.failListen) throw new Error("listen failed");
    return {};
  }
  async end(): Promise<void> {
    this.ended = true;
  }

  emitNotification(payload: string): void {
    this.notif?.({ payload });
  }
  emitEnd(): void {
    this.endCb?.();
  }
}

afterEach(() => vi.useRealTimers());

describe("RealtimeHub", () => {
  it("dispatches an event only to subscribers of that pool", async () => {
    const client = new FakeClient();
    const hub = new RealtimeHub(() => client);

    const p1: RealtimeMessage[] = [];
    const p2: RealtimeMessage[] = [];
    await hub.add({ poolId: "p1", send: (m) => p1.push(m) });
    await hub.add({ poolId: "p2", send: (m) => p2.push(m) });

    client.emitNotification(JSON.stringify({ poolId: "p1", type: "chat", at: "t1" }));

    expect(p1).toEqual([{ type: "chat", at: "t1" }]);
    expect(p2).toEqual([]);
  });

  it("opens only one shared client across many subscribers", async () => {
    let made = 0;
    const hub = new RealtimeHub(() => {
      made += 1;
      return new FakeClient();
    });
    await hub.add({ poolId: "p1", send: () => {} });
    await hub.add({ poolId: "p1", send: () => {} });
    await hub.add({ poolId: "p2", send: () => {} });
    expect(made).toBe(1);
  });

  it("evicts a subscriber whose send throws", async () => {
    const client = new FakeClient();
    const hub = new RealtimeHub(() => client);
    await hub.add({
      poolId: "p1",
      send: () => {
        throw new Error("stream gone");
      },
    });
    expect(hub.subscriberCount).toBe(1);
    client.emitNotification(JSON.stringify({ poolId: "p1", type: "chat", at: "t" }));
    expect(hub.subscriberCount).toBe(0);
  });

  it("ignores malformed payloads", async () => {
    const client = new FakeClient();
    const hub = new RealtimeHub(() => client);
    const got: RealtimeMessage[] = [];
    await hub.add({ poolId: "p1", send: (m) => got.push(m) });
    client.emitNotification("not json");
    expect(got).toEqual([]);
  });

  it("reconnects after the active client drops", async () => {
    vi.useFakeTimers();
    const clients: FakeClient[] = [];
    const hub = new RealtimeHub(() => {
      const c = new FakeClient();
      clients.push(c);
      return c;
    });

    const got: RealtimeMessage[] = [];
    await hub.add({ poolId: "p1", send: (m) => got.push(m) });
    expect(clients).toHaveLength(1);

    clients[0].emitEnd(); // connection dropped
    await vi.advanceTimersByTimeAsync(1000);
    expect(clients).toHaveLength(2); // reconnected

    clients[1].emitNotification(JSON.stringify({ poolId: "p1", type: "result", at: "t2" }));
    expect(got).toEqual([{ type: "result", at: "t2" }]);
  });

  it("keeps retrying after a failed reconnect instead of wedging", async () => {
    vi.useFakeTimers();
    const clients: FakeClient[] = [];
    let connectsFailing = true;
    const hub = new RealtimeHub(() => {
      const c = new FakeClient({ failConnect: connectsFailing });
      clients.push(c);
      return c;
    });

    // First connect fails; add() rejects but a retry is scheduled.
    await expect(hub.add({ poolId: "p1", send: () => {} })).rejects.toThrow();
    expect(clients[0].ended).toBe(true); // half-open connection cleaned up

    // Retry also fails (backoff ~2s), then the DB recovers.
    await vi.advanceTimersByTimeAsync(1000);
    expect(clients).toHaveLength(2);
    connectsFailing = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(clients).toHaveLength(3);

    // The recovered client delivers.
    const got: RealtimeMessage[] = [];
    hub.remove({ poolId: "x", send: () => {} }); // no-op; keep subscriber set intact
    await hub.add({ poolId: "p1", send: (m) => got.push(m) });
    clients[2].emitNotification(JSON.stringify({ poolId: "p1", type: "chat", at: "t" }));
    expect(got).toEqual([{ type: "chat", at: "t" }]);
  });
});
