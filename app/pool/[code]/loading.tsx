import { Skeleton } from "./Skeleton";

// Landing fallback: standing card + leaderboard list.
export default function HomeLoading() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-10 w-40" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </div>
      <ol className="mt-2.5 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-12" />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
