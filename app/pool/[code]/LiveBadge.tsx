// The shared live-match pill: a pulsing dot plus the current minute (or "Live"
// when the minute isn't known). Used by the match cards so the live indicator
// stays identical wherever it appears.
export function LiveBadge({ minute }: { minute?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
      {minute != null ? `${minute}'` : "Live"}
    </span>
  );
}
