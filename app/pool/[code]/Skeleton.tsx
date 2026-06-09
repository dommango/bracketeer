// Loading placeholder. `animate-pulse` is collapsed to a single frame under the
// global prefers-reduced-motion guard (app/globals.css).
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-sunk ${className ?? ""}`} aria-hidden />;
}

// A card-shaped skeleton row, matching the rounded-2xl surface cards used across
// the pool screens.
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-4 ${className ?? ""}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-6 w-2/3" />
    </div>
  );
}
