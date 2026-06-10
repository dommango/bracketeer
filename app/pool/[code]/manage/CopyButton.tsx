"use client";

import { useState } from "react";

// Copies the given text and briefly confirms. Falls back silently if the
// clipboard API is unavailable (e.g. insecure context) — the code is shown
// alongside, so copy is a convenience, not the only path.
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op: clipboard unavailable
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-surface-sunk px-4 text-sm font-semibold text-pitch-dark hover:bg-line-soft"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
