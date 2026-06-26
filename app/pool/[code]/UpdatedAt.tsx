import { formatRelativeTime, formatTimestamp } from "@/lib/pool/format";

// A small "Updated 3h ago" freshness stamp for odds / market surfaces. The exact
// fetch time sits in the title tooltip. Renders nothing without a timestamp (the
// market hasn't been polled yet), so callers can drop it in unconditionally.
export function UpdatedAt({
  date,
  className,
}: {
  date: Date | null | undefined;
  className?: string;
}) {
  if (!date) return null;
  return (
    <span
      title={formatTimestamp(date)}
      className={className ?? "text-[10px] text-ink-4"}
    >
      {formatRelativeTime(date)}
    </span>
  );
}
