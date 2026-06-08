// GET /api/pool/[id]/stream — Server-Sent Events for one pool.
//
// A dedicated pg Client LISTENs on the pool_events channel and forwards the
// events for this pool to the browser. Clients also poll as a fallback (see
// usePoolStream) because reverse proxies can drop SSE. Members only.

import { NextRequest } from "next/server";
import { Client } from "pg";
import { getPoolAccess } from "@/lib/pool/access";
import { env } from "@/lib/env";
import { POOL_EVENTS_CHANNEL } from "@/lib/realtime/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Each open stream holds a dedicated Postgres connection, so cap the total to
// avoid connection-pool exhaustion (a cheap DoS otherwise). The polling fallback
// in usePoolStream keeps rejected clients functional.
const MAX_STREAMS = 100;
let activeStreams = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;
  const access = await getPoolAccess(poolId);
  if (!access) return new Response("Not found", { status: 404 });

  if (activeStreams >= MAX_STREAMS) {
    return new Response("Too many streams; falling back to polling", { status: 503 });
  }
  activeStreams += 1;

  const encoder = new TextEncoder();
  let client: Client | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      activeStreams -= 1;
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (obj: unknown) => safeEnqueue(`data: ${JSON.stringify(obj)}\n\n`);

      send({ type: "hello", poolId });

      client = new Client({ connectionString: env.DATABASE_URL });
      try {
        await client.connect();
        // Channel name is a fixed identifier (not user input) — safe to inline.
        await client.query(`LISTEN ${POOL_EVENTS_CHANNEL}`);
        client.on("notification", (msg) => {
          if (!msg.payload) return;
          try {
            const data = JSON.parse(msg.payload) as { poolId?: string; type?: string; at?: string };
            if (data.poolId === poolId) send({ type: data.type, at: data.at });
          } catch {
            /* ignore malformed payloads */
          }
        });
        client.on("error", (err) => {
          console.error("SSE pg client error:", err);
          send({ type: "error" });
        });
      } catch (err) {
        console.error("SSE LISTEN setup failed:", err);
        send({ type: "error" });
      }

      // Comment frames keep idle proxies from closing the connection.
      keepAlive = setInterval(() => safeEnqueue(`: ping\n\n`), 25000);
    },
    async cancel() {
      closed = true;
      release();
      if (keepAlive) clearInterval(keepAlive);
      if (client) {
        try {
          await client.end();
        } catch {
          /* already gone */
        }
      }
    },
  });

  // Tear down if the request is aborted before the stream is cancelled.
  req.signal.addEventListener("abort", () => {
    closed = true;
    release();
    if (keepAlive) clearInterval(keepAlive);
    client?.end().catch(() => {});
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
