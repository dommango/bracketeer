"use client";

import { useEffect, useRef, useState } from "react";

// Points odometer. Renders the final value on the server (correct with no JS,
// no layout shift), then animates from the *previous* value to the new one when
// it changes — e.g. when realtime (PoolRealtime → router.refresh) brings in
// freshly scored totals. Honours prefers-reduced-motion (jumps straight there).
export function CountUp({
  value,
  className,
  durationMs = 600,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value); // last settled value; equals `value` on first mount

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let start = 0;
    // Jump straight to the value under reduced motion; otherwise ease toward it.
    // All setState happens inside the rAF callback (not synchronously in the
    // effect body) so it never triggers a cascading render.
    const step = (t: number) => {
      if (reduce) {
        setDisplay(to);
        fromRef.current = to;
        return;
      }
      if (!start) start = t;
      const p = Math.min((t - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
