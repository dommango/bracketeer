"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  color: string;
  thickness: number;
  points: Point[];
}

// Pitch-green leads the palette so annotations match the HessFest brand.
const COLORS = ["#0b6b3a", "#dc2626", "#facc15", "#1e40af", "#000000"];
const THICKNESSES = [2, 4, 8];

export interface ScreenshotAnnotatorProps {
  imageDataUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export function ScreenshotAnnotator({ imageDataUrl, onSave, onCancel }: ScreenshotAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>(COLORS[0]!);
  const [thickness, setThickness] = useState<number>(THICKNESSES[1]!);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setSize({ width: i.width, height: i.height });
    };
    i.src = imageDataUrl;
  }, [imageDataUrl]);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const s of strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const p0 = s.points[0];
      if (!p0) continue;
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i]!;
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }, [img, strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Map a mouse event in display coordinates to the canvas's natural pixel
  // coordinates — the canvas is downscaled with max-h/max-w CSS, so client
  // pixels and canvas pixels diverge.
  function toCanvasCoord(e: React.MouseEvent<HTMLCanvasElement>): Point | null {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = toCanvasCoord(e);
    if (!p) return;
    setDrawing(true);
    setStrokes((prev) => [...prev, { color, thickness, points: [p] }]);
  }
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const p = toCanvasCoord(e);
    if (!p) return;
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      return [...prev.slice(0, -1), { ...last, points: [...last.points, p] }];
    });
  }
  function handleMouseUp() {
    setDrawing(false);
  }

  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1));
  }
  function handleClear() {
    setStrokes([]);
  }

  function handleSave() {
    const c = canvasRef.current;
    if (!c) return;
    onSave(c.toDataURL("image/jpeg", 0.85));
  }

  // Esc cancels without saving.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="annotator-title"
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-2xl bg-surface p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 id="annotator-title" className="text-sm font-semibold text-ink">
            Annotate screenshot
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-ink-4 hover:text-ink"
            aria-label="Close annotator"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-3">Color</span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
              }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={`h-5 w-5 rounded-full border-2 ${
                color === c ? "border-ink" : "border-line"
              }`}
              style={{ background: c }}
            />
          ))}
          <span className="ml-3 text-ink-3">Size</span>
          {THICKNESSES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setThickness(t);
              }}
              aria-label={`Thickness ${t}`}
              aria-pressed={thickness === t}
              className={`flex h-6 w-6 items-center justify-center rounded border ${
                thickness === t ? "border-ink" : "border-line"
              }`}
            >
              <span
                className="rounded-full bg-ink"
                style={{ width: t, height: t, display: "inline-block" }}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="ml-auto rounded-lg border border-line px-2 py-1 text-ink-3 hover:bg-surface-sunk disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="rounded-lg border border-line px-2 py-1 text-ink-3 hover:bg-surface-sunk disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl border border-line bg-surface-sunk">
          {size && (
            <canvas
              ref={canvasRef}
              width={size.width}
              height={size.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="max-h-[60vh] max-w-full cursor-crosshair"
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-3 hover:bg-surface-sunk"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-pitch px-3 py-1.5 text-xs font-medium text-white hover:bg-pitch-dark"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
