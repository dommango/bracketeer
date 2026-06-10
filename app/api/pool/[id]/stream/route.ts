// GET /api/pool/[id]/stream — Server-Sent Events for one pool.
//
// Each stream registers an in-memory subscriber on the shared realtime hub (one
// process-wide Postgres LISTEN feeds them all — see lib/realtime/hub.ts). Clients
// also poll as a fallback (see usePoolStream) because reverse proxies can drop
// SSE. Members only.

import { NextRequest } from "next/server";
import { getPoolAccess } from "@/lib/pool/access";
import { realtimeHub, type Subscriber } from "@/lib/realtime/hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Subscribers are cheap (in-memory callbacks over the shared LISTEN), but each
// still holds an open HTTP connection, so keep a generous backstop against a
// connection-flood DoS. The polling fallback keeps rejected clients functional.
const MAX_STREAMS = 2000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;
  const access = await getPoolAccess(poolId);
  if (!access) return new Response("Not found", { status: 404 });

  if (realtimeHub.subscriberCount >= MAX_STREAMS) {
    return new Response("Too many streams; falling back to polling", { status: 503 });
  }

  const encoder = new TextEncoder();
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let subscriber: Subscriber | null = null;
  let closed = false;

  const cleanup = () => {
    closed = true;
    if (keepAlive) clearInterval(keepAlive);
    if (subscriber) realtimeHub.remove(subscriber);
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

      subscriber = { poolId, send: (msg) => send(msg) };
      try {
        await realtimeHub.add(subscriber);
      } catch (err) {
        console.error("SSE hub subscribe failed:", err);
        send({ type: "error" });
      }

      // Comment frames keep idle proxies from closing the connection.
      keepAlive = setInterval(() => safeEnqueue(`: ping\n\n`), 25000);
    },
    cancel() {
      cleanup();
    },
  });

  // Tear down if the request is aborted before the stream is cancelled.
  req.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
