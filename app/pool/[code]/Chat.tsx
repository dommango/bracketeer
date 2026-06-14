"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePoolStream } from "./usePoolStream";
import { DISPLAY_TZ } from "@/lib/tz";

export interface ChatMessage {
  id: string;
  body: string;
  userId: string;
  authorName: string;
  createdAt: string;
}

function timeLabel(iso: string): string {
  // Pinned to the pool's display zone (Eastern) so timestamps read the same for
  // everyone, matching kickoff times — not each viewer's browser zone.
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  });
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
    <div className="rounded-2xl border border-line bg-surface">
      <div className="max-h-80 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 text-sm ${
                    mine ? "bg-pitch text-white" : "bg-surface-sunk text-ink"
                  }`}
                  style={{
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                  }}
                >
                  {!mine ? (
                    <p className="mb-0.5 text-[11px] font-bold tracking-[0.04em] text-pitch-dark">
                      {m.authorName}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      mine ? "text-white/60" : "text-ink-3"
                    }`}
                  >
                    {timeLabel(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Message your pool…"
          className="h-11 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="h-11 rounded-full bg-pitch px-5 text-sm font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.97] disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error ? <p className="px-4 pb-3 text-xs text-[var(--negative)]">{error}</p> : null}
    </div>
  );
}
