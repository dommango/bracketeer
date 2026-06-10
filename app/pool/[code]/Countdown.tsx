"use client";

import { useEffect, useState } from "react";

interface Segment {
  value: number;
  unit: string;
}

function segments(msRemaining: number, showSeconds: boolean): Segment[] {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const base: Segment[] = [
    { value: Math.floor(total / 86400), unit: "d" },
    { value: Math.floor((total % 86400) / 3600), unit: "h" },
    { value: Math.floor((total % 3600) / 60), unit: "m" },
  ];
  return showSeconds ? [...base, { value: total % 60, unit: "s" }] : base;
}

// Live countdown to an ISO target. Ticks once a second on the client; renders a
// stable placeholder until mounted so server and client markup agree, then a
// "Locked" label once the target passes.
export function Countdown({
  target,
  showSeconds = true,
  className = "",
}: {
  target: string;
  showSeconds?: boolean;
  className?: string;
}) {
  const targetMs = new Date(target).getTime();
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (nowMs === null) {
    return <span className={`font-mono tabular-nums ${className}`}>·&nbsp;·&nbsp;·</span>;
  }

  const remaining = targetMs - nowMs;
  if (remaining <= 0) {
    return (
      <span className={`font-mono font-bold uppercase tracking-[0.06em] ${className}`}>Locked</span>
    );
  }

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {segments(remaining, showSeconds).map((seg) => (
        <span key={seg.unit} className="mr-1.5">
          {seg.value}
          <span className="text-[0.8em] opacity-70">{seg.unit}</span>
        </span>
      ))}
    </span>
  );
}
