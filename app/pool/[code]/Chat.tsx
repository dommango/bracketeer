"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePoolStream } from "./usePoolStream";

export interface ChatMessage {
  id: string;
  body: string;
  userId: string;
  authorName: string;
  createdAt: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Chat({
  poolId,
  currentUserId,
  initialMessages,
}: {
  poolId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/pool/${poolId}/chat?limit=50`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json?.data?.messages)) setMessages(json.data.messages);
    } catch {
      /* transient — next signal retries */
    }
  }, [poolId]);

  usePoolStream(poolId, (signal) => {
    if (signal === "chat" || signal === "poll") void refresh();
  }, 20000);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/pool/${poolId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || "Failed to send");
      } else {
        setBody("");
        await refresh();
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white">
      <div className="max-h-80 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-black/40">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine ? "bg-pitch text-white" : "bg-black/5 text-black"
                  }`}
                >
                  {!mine ? (
                    <p className="text-[11px] font-semibold text-pitch-dark">{m.authorName}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? "text-white/60" : "text-black/40"}`}>
                    {timeLabel(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-black/10 p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Message your pool…"
          className="flex-1 rounded-full border border-black/15 px-4 py-2 text-sm outline-none focus:border-pitch"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-full bg-pitch px-4 py-2 text-sm font-medium text-white hover:bg-pitch-dark disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error ? <p className="px-4 pb-3 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
