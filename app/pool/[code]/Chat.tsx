"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePoolStream } from "./usePoolStream";
import { DISPLAY_TZ } from "@/lib/tz";
import type { GifResult } from "@/lib/chat/giphy";

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
  apiBase,
  currentUserId,
  initialMessages,
  giphyEnabled = false,
  canPost = true,
  composerHint,
  placeholder = "Message your pool…",
  pollMs = 20000,
}: {
  // A pool chat passes poolId (drives the SSE stream); the global challenge chat
  // passes apiBase and no poolId (poll-only — no pool-scoped stream).
  poolId?: string;
  apiBase?: string;
  currentUserId: string | null;
  initialMessages: ChatMessage[];
  giphyEnabled?: boolean;
  // When false, the composer + per-message actions are hidden (read-only view) and
  // composerHint is shown instead — e.g. a signed-out or not-entered challenge viewer.
  canPost?: boolean;
  composerHint?: string;
  placeholder?: string;
  pollMs?: number;
}) {
  // Endpoint base: a pool's namespaced API, or the global challenge chat base.
  const base = apiBase ?? `/api/pool/${poolId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Whether the view was near the bottom before the last messages update, so we
  // don't yank a user who has scrolled up to read history.
  const nearBottomRef = useRef(true);
  const initialMountRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${base}/chat?limit=50`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json?.data?.messages)) setMessages(json.data.messages);
    } catch {
      /* transient — next signal retries */
    }
  }, [base]);

  usePoolStream(
    poolId ?? null,
    (signal) => {
      if (signal === "chat" || signal === "poll") void refresh();
    },
    pollMs,
  );

  useEffect(() => {
    // Newest messages render at the bottom (normal chat). Jump straight to the
    // bottom on first mount (no animation), then only follow new messages when the
    // user is already near the bottom — otherwise leave them where they scrolled.
    if (initialMountRef.current) {
      initialMountRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Single POST path shared by the text composer and the GIF picker. Returns
  // true on success so callers can clear their own UI state.
  const postChat = useCallback(
    async (payload: {
      body?: string;
      attachmentUrl?: string;
      attachmentType?: "GIF" | "IMAGE";
    }): Promise<boolean> => {
      setSending(true);
      setError(null);
      try {
        const res = await fetch(`${base}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, replyToId: replyTo?.id }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          setError(json?.error || "Failed to send");
          return false;
        }
        setReplyTo(null);
        // Always follow my own message down to the bottom, even if I'd scrolled up.
        nearBottomRef.current = true;
        await refresh();
        return true;
      } catch {
        setError("Network error — try again");
        return false;
      } finally {
        setSending(false);
      }
    },
    [base, replyTo, refresh],
  );

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    if (await postChat({ body: text })) setBody("");
  }

  async function sendGif(result: GifResult) {
    if (sending) return;
    if (await postChat({ attachmentUrl: result.url, attachmentType: "GIF" })) {
      setGifOpen(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    setPickerFor(null);
    try {
      const res = await fetch(`${base}/chat/react`, {
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
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-96 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">No messages yet. Say hello 👋</p>
        ) : (
          // Server returns oldest→newest; render in that order so the newest sits
          // at the bottom, as chats normally read.
          messages.map((m) =>
            m.kind === "SYSTEM" ? (
              <SystemRow key={m.id} m={m} />
            ) : (
              <MessageRow
                key={m.id}
                m={m}
                mine={m.userId === currentUserId}
                interactive={canPost}
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

      {canPost ? (
        <>
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

          {giphyEnabled && gifOpen ? (
            <GifPicker onPick={sendGif} disabled={sending} />
          ) : null}

          <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
            {giphyEnabled ? (
              <button
                type="button"
                onClick={() => setGifOpen((v) => !v)}
                aria-label="Add a GIF"
                aria-pressed={gifOpen}
                className={`h-11 shrink-0 rounded-full border px-3 text-xs font-bold tracking-wide transition-colors ${
                  gifOpen
                    ? "border-pitch bg-pitch-tint text-pitch-dark"
                    : "border-line bg-surface text-ink-2 hover:bg-surface-sunk"
                }`}
              >
                GIF
              </button>
            ) : null}
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder={replyTo ? "Write a reply…" : placeholder}
              className="h-11 flex-1 rounded-full border border-line bg-surface px-4 text-base text-ink outline-none transition-[border-color,box-shadow] focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]"
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
        </>
      ) : composerHint ? (
        <p className="border-t border-line px-4 py-3 text-center text-[13px] text-ink-3">
          {composerHint}
        </p>
      ) : null}
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
  interactive,
  onToggle,
}: {
  reactions: ReactionGroup[];
  // Read-only viewers get non-interactive spans, not buttons that look tappable.
  interactive: boolean;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    // Negative margin keeps the row visually compact while each pill still offers a
    // ~44px tall touch target.
    <div className="mt-1 flex flex-wrap gap-1 -my-1.5">
      {reactions.map((r) => {
        const cls = `inline-flex min-h-[44px] items-center gap-0.5 rounded-full border px-2.5 py-1 text-[12px] tabular-nums transition-colors ${
          r.mine
            ? "border-pitch bg-pitch-tint text-pitch-dark"
            : "border-line bg-surface text-ink-2"
        }`;
        return interactive ? (
          <button
            key={r.emoji}
            onClick={() => onToggle(r.emoji)}
            className={`${cls} hover:bg-surface-sunk`}
          >
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </button>
        ) : (
          <span key={r.emoji} className={cls}>
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </span>
        );
      })}
    </div>
  );
}

function MessageRow({
  m,
  mine,
  interactive,
  pickerOpen,
  onReply,
  onOpenPicker,
  onReact,
}: {
  m: ChatMessage;
  mine: boolean;
  // When false (read-only viewer), the react/reply controls and picker are hidden.
  interactive: boolean;
  pickerOpen: boolean;
  onReply: () => void;
  onOpenPicker: () => void;
  onReact: (emoji: string) => void;
}) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className="group flex max-w-[85%] items-end gap-1.5">
        {/* Action buttons sit on the inside edge of the bubble. */}
        {interactive && mine ? (
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
        {interactive && !mine ? (
          <MessageActions onReply={onReply} onOpenPicker={onOpenPicker} />
        ) : null}
      </div>

      {interactive && pickerOpen ? (
        <div className="mt-1 flex gap-0.5 rounded-full border border-line bg-surface px-1 py-0.5 shadow-[var(--shadow-sm)]">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-surface-sunk"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <ReactionBar reactions={m.reactions} interactive={interactive} onToggle={onReact} />
    </div>
  );
}

// Inline GIF search/trending panel. Debounces input and sends the picked GIF
// immediately via onPick. Results are kept small (previewUrl thumbnails).
function GifPicker({
  onPick,
  disabled,
}: {
  onPick: (result: GifResult) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/giphy/search?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!cancelled && Array.isArray(json?.data?.results)) {
          setResults(json.data.results as GifResult[]);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="border-t border-line bg-surface-sunk p-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search GIFs…"
        aria-label="Search GIFs"
        className="mb-2 h-10 w-full rounded-full border border-line bg-surface px-3 text-base text-ink outline-none focus:border-pitch"
      />
      <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4">
        {loading && results.length === 0 ? (
          <p className="col-span-full py-4 text-center text-xs text-ink-3">Loading…</p>
        ) : results.length === 0 ? (
          <p className="col-span-full py-4 text-center text-xs text-ink-3">No GIFs found</p>
        ) : (
          results.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(r)}
              aria-label="Send this GIF"
              className="overflow-hidden rounded-lg border border-line bg-surface transition-transform hover:scale-[1.03] disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.previewUrl}
                alt="GIF preview"
                className="h-20 w-full object-cover"
                loading="lazy"
              />
            </button>
          ))
        )}
      </div>
      <p className="mt-1.5 text-right text-[10px] text-ink-3">Powered by GIPHY</p>
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
  // 44px touch targets, but negative vertical margins pull the stacked pair back so
  // the row stays as compact as before.
  return (
    <div className="-my-3 flex shrink-0 flex-col justify-center opacity-40 transition-opacity group-hover:opacity-100">
      <button
        onClick={onOpenPicker}
        aria-label="React"
        className="-my-1 flex h-11 w-11 items-center justify-center rounded-full text-[15px] leading-none text-ink-3 hover:bg-surface-sunk hover:text-ink"
      >
        🙂
      </button>
      <button
        onClick={onReply}
        aria-label="Reply"
        className="-my-1 flex h-11 w-11 items-center justify-center rounded-full text-[15px] leading-none text-ink-3 hover:bg-surface-sunk hover:text-ink"
      >
        ↩
      </button>
    </div>
  );
}
