"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenshotAnnotator } from "./ScreenshotAnnotator";

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): SelectionRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

// Captures the full document.body via html-to-image, then crops to the given
// viewport-relative rectangle. The crop uses the same pixelRatio passed to
// html-to-image so rect coords line up on high-DPI screens.
async function captureRegion(rect: SelectionRect): Promise<string> {
  const { toJpeg } = await import("html-to-image");
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  // html-to-image captures at document-scroll-origin, but our rect is
  // viewport-relative — add scroll offsets so the crop lines up with what
  // the user selected.
  const absX = rect.x + window.scrollX;
  const absY = rect.y + window.scrollY;
  const fullDataUrl: string = await toJpeg(document.body, {
    quality: 0.6,
    pixelRatio,
    cacheBust: true,
    skipFonts: true,
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      resolve();
    };
    img.onerror = () => {
      reject(new Error("Failed to load captured image"));
    };
    img.src = fullDataUrl;
  });
  const sx = Math.round(absX * pixelRatio);
  const sy = Math.round(absY * pixelRatio);
  const sw = Math.round(rect.width * pixelRatio);
  const sh = Math.round(rect.height * pixelRatio);
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/jpeg", 0.6);
}

// Literal API values expected by the server's Zod schema.
type FeedbackType = "BUG" | "IDEA" | "OTHER";

const TYPE_CONFIG: Record<FeedbackType, { label: string; emoji: string }> = {
  BUG: { label: "Bug", emoji: "🐛" },
  IDEA: { label: "Idea", emoji: "💡" },
  OTHER: { label: "Other", emoji: "💬" },
};

const MAX_SCREENSHOTS = 3;

type Status = { kind: "success" | "error"; message: string } | null;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // Inline success/error message rendered inside the modal — no toast system.
  const [status, setStatus] = useState<Status>(null);
  // Region-select snipping-tool state. `selecting` toggles the overlay on/off.
  // `dragStart` / `dragEnd` track the user's drag in viewport pixels.
  const [selecting, setSelecting] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addScreenshot = useCallback((dataUrl: string) => {
    setScreenshots((prev) => {
      if (prev.length >= MAX_SCREENSHOTS) {
        setStatus({ kind: "error", message: `Maximum ${MAX_SCREENSHOTS} screenshots per submission` });
        return prev;
      }
      return [...prev, dataUrl];
    });
  }, []);

  const removeScreenshot = useCallback((index: number) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const replaceScreenshot = useCallback((index: number, dataUrl: string) => {
    setScreenshots((prev) => prev.map((s, i) => (i === index ? dataUrl : s)));
  }, []);

  const handleFileUpload = useCallback(
    (files: FileList) => {
      const remaining = MAX_SCREENSHOTS - screenshots.length;
      if (remaining <= 0) {
        setStatus({ kind: "error", message: `Maximum ${MAX_SCREENSHOTS} screenshots per submission` });
        return;
      }
      const accepted = Array.from(files).slice(0, remaining);
      for (const file of accepted) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") addScreenshot(result);
        };
        reader.onerror = () => {
          setStatus({ kind: "error", message: "Failed to read uploaded image" });
        };
        reader.readAsDataURL(file);
      }
    },
    [addScreenshot, screenshots.length],
  );

  // Region-select flow: click "Screenshot" → hide widget → mount overlay →
  // user drags a rectangle → capture + crop → show preview. Mirrors OS
  // snipping-tool UX.
  const priorDisplayRef = useRef<string>("");

  const startRegionSelect = useCallback(() => {
    const widget = widgetRef.current;
    priorDisplayRef.current = widget?.style.display ?? "";
    if (widget) widget.style.display = "none";
    setDragStart(null);
    setDragEnd(null);
    setSelecting(true);
  }, []);

  const endRegionSelect = useCallback(() => {
    setSelecting(false);
    setDragStart(null);
    setDragEnd(null);
    const widget = widgetRef.current;
    if (widget) widget.style.display = priorDisplayRef.current;
  }, []);

  const performCapture = useCallback(
    async (rect: SelectionRect) => {
      setCapturing(true);
      // Remove overlay before capturing so it's not baked into the image.
      setSelecting(false);
      try {
        const dataUrl = await captureRegion(rect);
        addScreenshot(dataUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Screenshot capture failed";
        setStatus({ kind: "error", message: `Screenshot failed: ${message}` });
      } finally {
        setCapturing(false);
        const widget = widgetRef.current;
        if (widget) widget.style.display = priorDisplayRef.current;
      }
    },
    [addScreenshot],
  );

  // Esc cancels the snipping overlay without capturing.
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        endRegionSelect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [selecting, endRegionSelect]);

  // Cmd/Ctrl+Shift+F opens the widget from anywhere. Suppressed while the user
  // is typing into an input, textarea, or contentEditable so the shortcut
  // doesn't hijack normal text-entry contexts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!(e.shiftKey && (e.metaKey || e.ctrlKey) && key === "f")) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setScreenshots([]);
    setType("BUG");
  }, []);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    setStatus(null);
    // Only include optional fields when they actually have a value — the server
    // Zod schema rejects empty strings / nulls, so sending `description: ''`
    // (or `screenshots: []`) would 400 on text-only submits.
    const trimmedDescription = description.trim();
    const payload: Record<string, unknown> = {
      type,
      title: title.trim(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    };
    if (trimmedDescription) payload.description = trimmedDescription;
    if (screenshots.length > 0) payload.screenshots = screenshots;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setStatus({ kind: "success", message: "Thanks — your feedback was sent!" });
        resetForm();
        // Close after a beat so the user sees the thank-you state.
        window.setTimeout(() => {
          setOpen(false);
          setStatus(null);
        }, 1600);
      } else {
        setStatus({ kind: "error", message: json?.error ?? "Failed to submit" });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error — try again" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
        }}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-pitch text-white shadow-lg transition-transform hover:scale-110 hover:bg-pitch-dark active:scale-95 sm:bottom-6"
        title="Send feedback (⌘⇧F)"
        aria-label="Send feedback (Cmd/Ctrl+Shift+F)"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 11.5c0 4.142-4.03 7.5-9 7.5a9.86 9.86 0 01-4.255-.949L3 20.5l1.395-4.18A7.5 7.5 0 013 11.5C3 7.358 7.03 4 12 4s9 3.358 9 7.5z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 2.5h.01" />
        </svg>
      </button>
    );
  }

  const selectionRect = dragStart && dragEnd ? rectFromPoints(dragStart, dragEnd) : null;

  return (
    <>
      {/* Snipping-tool overlay — only while selecting. Covers the viewport
          with a crosshair; a dashed pitch-green rectangle tracks the drag. On
          mouseup with a usable rect, kick off capture+crop. Clicking
          without dragging (rect < 10x10) cancels cleanly. */}
      {selecting && (
        <div
          className="fixed inset-0 z-[9999] cursor-crosshair"
          style={{ background: "rgba(0, 0, 0, 0.08)" }}
          onMouseDown={(e) => {
            setDragStart({ x: e.clientX, y: e.clientY });
            setDragEnd({ x: e.clientX, y: e.clientY });
          }}
          onMouseMove={(e) => {
            if (!dragStart) return;
            setDragEnd({ x: e.clientX, y: e.clientY });
          }}
          onMouseUp={() => {
            const r = selectionRect;
            if (!r || r.width < 10 || r.height < 10) {
              endRegionSelect();
              return;
            }
            void performCapture(r);
          }}
        >
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-ink/80 px-4 py-1.5 text-xs font-medium text-white shadow">
            Drag to select a region · Esc to cancel
          </div>
          {selectionRect && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height,
                border: "2px dashed #0b6b3a",
                background: "rgba(11, 107, 58, 0.1)",
              }}
            />
          )}
        </div>
      )}

      <div
        ref={widgetRef}
        className="fixed bottom-20 right-4 z-50 w-80 rounded-2xl border border-line bg-surface shadow-2xl sm:bottom-6 sm:w-96"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Send feedback</h3>
          <button
            onClick={() => {
              setOpen(false);
              setStatus(null);
            }}
            className="text-ink-4 hover:text-ink-2"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 p-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {(Object.entries(TYPE_CONFIG) as [FeedbackType, (typeof TYPE_CONFIG)[FeedbackType]][]).map(
              ([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setType(key);
                  }}
                  aria-pressed={type === key}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    type === key
                      ? "bg-pitch-tint text-pitch-dark ring-1 ring-pitch"
                      : "bg-surface-sunk text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {config.emoji} {config.label}
                </button>
              ),
            )}
          </div>

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder={
              type === "BUG" ? "What went wrong?" : type === "IDEA" ? "What would you like?" : "Your feedback…"
            }
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]"
            autoFocus
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            placeholder="What were you trying to do? What did you expect vs. what happened? (optional but helps triage)"
            rows={3}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-pitch focus:shadow-[0_0_0_3px_rgba(11,107,58,0.15)]"
          />
          <p className="text-[11px] text-ink-4">
            Tip: a sentence about expected vs actual saves us a round-trip.
          </p>

          {/* Screenshot */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                startRegionSelect();
              }}
              disabled={capturing || selecting || screenshots.length >= MAX_SCREENSHOTS}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-3 hover:bg-surface-sunk disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              {capturing ? "Capturing…" : selecting ? "Drag to select…" : "Screenshot"}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={capturing || selecting || screenshots.length >= MAX_SCREENSHOTS}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-3 hover:bg-surface-sunk disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files);
                }
                e.target.value = "";
              }}
            />
            <span className="text-[10px] text-ink-4">
              {screenshots.length}/{MAX_SCREENSHOTS}
            </span>
          </div>
          {screenshots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {screenshots.map((src, index) => (
                <div
                  key={`${index}-${src.slice(0, 32)}`}
                  className="group relative h-14 w-20 overflow-hidden rounded-lg border border-line"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAnnotatingIndex(index);
                    }}
                    className="block h-full w-full"
                    aria-label={`Annotate screenshot ${index + 1}`}
                    title="Click to annotate"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Screenshot ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-medium uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Annotate
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      removeScreenshot(index);
                    }}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Remove screenshot ${index + 1}`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {annotatingIndex !== null && screenshots[annotatingIndex] && (
            <ScreenshotAnnotator
              imageDataUrl={screenshots[annotatingIndex]!}
              onSave={(dataUrl) => {
                replaceScreenshot(annotatingIndex, dataUrl);
                setAnnotatingIndex(null);
              }}
              onCancel={() => {
                setAnnotatingIndex(null);
              }}
            />
          )}

          {/* Auto-captured context (the signed-in user is captured server-side). */}
          <p className="text-[10px] text-ink-4">Page: {window.location.pathname}</p>

          {/* Inline status message */}
          {status && (
            <p
              className={`rounded-xl px-3 py-2 text-xs ${
                status.kind === "success"
                  ? "bg-pitch-tint text-pitch-dark"
                  : "border border-negative/40 bg-negative/10 text-negative"
              }`}
            >
              {status.message}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={() => void handleSubmit()}
            disabled={!title.trim() || submitting}
            className="w-full rounded-xl bg-pitch px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pitch-dark active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </>
  );
}
