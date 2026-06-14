"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePoolStream } from "./usePoolStream";
import { DISPLAY_TZ } from "@/lib/tz";

export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface ReplyPreview {
  id: string;
  authorName: string | null;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  kind: "USER" | "SYSTEM";
  body: string;
  userId: string | null;
  authorName: string | null;
  createdAt: string;
  replyTo: ReplyPreview | null;
  attachmentUrl: string | null;
  attachmentType: "GIF" | "IMAGE" | null;
  meta: Record<string, unknown> | null;
  reactions: ReactionGroup[];
}

// Must match the server's ALLOWED_EMOJI (chat/react route).
const REACTIONS = ["👍", "🔥", "😂", "😮", "😢", "⚽", "🎉", "💀"];

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
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
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

  usePoolStream(
    poolId,
    (signal) => {
      if (signal === "chat" || signal === "poll") void refresh();
    },
    20000,
  );

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
        body: JSON.stringify({ body: text, replyToId: replyTo?.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error || "Failed to send");
      } else {
        setBody("");
        setReplyTo(null);
        await refresh();
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setSending(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    setPickerFor(null);
    try {
      const res = await fetch(`/api/pool/${poolId}/chat/react`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      if (res.ok) await refresh();
    } catch {
      /* transient */
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="max-h-96 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) =>
            m.kind === "SYSTEM" ? (
              <SystemRow key={m.id} m={m} />
            ) : (
              <MessageRow
                key={m.id}
                m={m}
                mine={m.userId === currentUserId}
                pickerOpen={pickerFor === m.id}
                onReply={() => setReplyTo(m)}
                onOpenPicker={() => setPickerFor((cur) => (cur === m.id ? null : m.id))}
                onReact={(emoji) => react(m.id, emoji)}
              />
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo ? (
        <div className="flex items-center gap-2 border-t border-line bg-surface-sunk px-3 py-2 text-xs">
          <span className="h-7 w-0.5 shrink-0 rounded-full bg-pitch" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-pitch-dark">
              Replying to {replyTo.authorName ?? "event"}
            </span>
            <span className="block truncate text-ink-3">{replyTo.body || "Attachment"}</span>
          </span>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="shrink-0 rounded-full px-2 py-1 font-bold text-ink-3 hover:bg-surface hover:text-ink"
          >
            ✕
          </button>
        </div>
      ) : null}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder={replyTo ? "Write a reply…" : "Message your pool…"}
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

// Centered, author-less card for an auto-posted match event.
function SystemRow({ m }: { m: ChatMessage }) {
  return (
    <div className="flex justify-center">
      <span className="max-w-[90%] rounded-full bg-surface-sunk px-3 py-1 text-center text-[12px] font-medium text-ink-2">
        {m.body}
      </span>
    </div>
  );
}

function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: ReactionGroup[];
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[11px] tabular-nums transition-colors ${
            r.mine
              ? "border-pitch bg-pitch-tint text-pitch-dark"
              : "border-line bg-surface text-ink-2 hover:bg-surface-sunk"
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
    </div>
  );
}

function MessageRow({
  m,
  mine,
  pickerOpen,
  onReply,
  onOpenPicker,
  onReact,
}: {
  m: ChatMessage;
  mine: boolean;
  pickerOpen: boolean;
  onReply: () => void;
  onOpenPicker: () => void;
  onReact: (emoji: string) => void;
}) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className="group flex max-w-[85%] items-end gap-1.5">
        {/* Action buttons sit on the inside edge of the bubble. */}
        {mine ? (
          <MessageActions onReply={onReply} onOpenPicker={onOpenPicker} />
        ) : null}
        <div
          className={`px-3 py-2 text-sm ${mine ? "bg-pitch text-white" : "bg-surface-sunk text-ink"}`}
          style={{
            borderRadius: 16,
            borderBottomRightRadius: mine ? 4 : 16,
            borderBottomLeftRadius: mine ? 16 : 4,
          }}
        >
          {!mine && m.authorName ? (
            <p className="mb-0.5 text-[11px] font-bold tracking-[0.04em] text-pitch-dark">
              {m.authorName}
            </p>
          ) : null}

          {m.replyTo ? (
            <div
              className={`mb-1 rounded-md border-l-2 px-2 py-1 text-[11px] ${
                mine ? "border-white/50 bg-white/10 text-white/80" : "border-pitch/50 bg-surface text-ink-3"
              }`}
            >
              <span className="font-semibold">{m.replyTo.authorName ?? "event"}</span>
              <span className="ml-1 break-words">{m.replyTo.excerpt}</span>
            </div>
          ) : null}

          {m.attachmentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.attachmentUrl}
              alt={m.attachmentType === "GIF" ? "GIF" : "shared image"}
              className="mb-1 max-h-60 w-auto rounded-lg"
              loading="lazy"
            />
          ) : null}

          {m.body ? <p className="whitespace-pre-wrap break-words leading-snug">{m.body}</p> : null}

          <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/60" : "text-ink-3"}`}>
            {timeLabel(m.createdAt)}
          </p>
        </div>
        {!mine ? (
          <MessageActions onReply={onReply} onOpenPicker={onOpenPicker} />
        ) : null}
      </div>

      {pickerOpen ? (
        <div className="mt-1 flex gap-1 rounded-full border border-line bg-surface px-2 py-1 shadow-[var(--shadow-sm)]">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className="rounded-full px-1 text-base leading-none transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <ReactionBar reactions={m.reactions} onToggle={onReact} />
    </div>
  );
}

// React + reply controls — faint until the row is hovered (always tappable on touch).
function MessageActions({
  onReply,
  onOpenPicker,
}: {
  onReply: () => void;
  onOpenPicker: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
      <button
        onClick={onOpenPicker}
        aria-label="React"
        className="rounded-full px-1 text-[13px] leading-none text-ink-3 hover:text-ink"
      >
        🙂
      </button>
      <button
        onClick={onReply}
        aria-label="Reply"
        className="rounded-full px-1 text-[13px] leading-none text-ink-3 hover:text-ink"
      >
        ↩
      </button>
    </div>
  );
}
