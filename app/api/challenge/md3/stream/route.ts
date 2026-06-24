// GET /api/challenge/md3/stream — Server-Sent Events for the public Match Day
// Pickem board.
//
// The challenge leaderboard is built from standalone entries (poolId == null), so
// it has no pool id to subscribe to. Instead it rides the tournament-scoped
// standalone channel that recomputeTournamentPools notifies whenever those entries
// rescore (i.e. when a result lands). Public board, so no membership check — same
// shared Postgres LISTEN hub and polling fallback as the pool stream.

import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { standaloneChannelId } from "@/lib/realtime/events";
import { realtimeHub, type Subscriber } from "@/lib/realtime/hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Same generous backstop as the pool stream; rejected clients fall back to polling.
const MAX_STREAMS = 2000;

export async function GET(req: Request) {
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  if (!tournamentId) return new Response("Not found", { status: 404 });

  if (realtimeHub.subscriberCount >= MAX_STREAMS) {
    return new Response("Too many streams; falling back to polling", { status: 503 });
  }

  const channel = standaloneChannelId(tournamentId);
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

      send({ type: "hello", channel });

      subscriber = { poolId: channel, send: (msg) => send(msg) };
      try {
        await realtimeHub.add(subscriber);
      } catch (err) {
        console.error("MD3 SSE hub subscribe failed:", err);
        send({ type: "error" });
      }

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
