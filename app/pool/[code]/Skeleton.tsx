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

// A pill-toggle placeholder, mirroring the rounded-full segmented nav rows
// (BracketsTabNav, the Matches view toggle, the fixture grouping toggle) that
// several pool pages lead with. `count` matches the number of real tabs.
export function SkeletonTabNav({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div
      className={`flex gap-1 rounded-full border border-line bg-surface-sunk p-1 ${className ?? ""}`}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 flex-1 rounded-full" />
      ))}
    </div>
  );
}

// A match-card placeholder, matching the rounded-2xl p-4 fixture/score cards
// (MatchCenter's MatchRow and Home's ScoreCards): a header row, two team rows
// separated by a hairline, and a venue line.
export function SkeletonMatchCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
      <div className="flex items-center gap-2.5 py-1">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-6 w-7" />
      </div>
      <div className="my-0.5 h-px bg-line-soft" />
      <div className="flex items-center gap-2.5 py-1">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-6 w-7" />
      </div>
      <Skeleton className="mt-2 h-3 w-2/3" />
    </div>
  );
}
