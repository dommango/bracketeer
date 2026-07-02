"use client";

import { useEffect, useState } from "react";
import { Countdown } from "./Countdown";
import { LABEL } from "@/lib/ui/labels";

// A slim "Round of 32 kicks off in …" banner for full-bracket pools. Self-hides
// once the target passes (ticks on the client), so it disappears the moment the
// R32 is under way — and keeps the server component pure (no render-time clock).
export function R32Countdown({ target, label }: { target: string; label: string }) {
  const targetMs = new Date(target).getTime();
  // Seed from the clock, not `false`: once the kickoff is in the past both the
  // server render and the client's first paint agree it's gone, instead of
  // flashing a stale "kicks off in · · ·" banner that the mount effect removes.
  // (Server and client clocks only disagree across the kickoff instant itself.)
  const [passed, setPassed] = useState(() => Date.now() >= targetMs);

  useEffect(() => {
    const tick = () => setPassed(Date.now() >= targetMs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (passed) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-[var(--shadow-xs)]">
      <span className={LABEL}>{label}</span>
      <Countdown target={target} showSeconds={false} className="text-sm font-semibold text-ink" />
    </div>
  );
}
