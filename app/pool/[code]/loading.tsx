import { Skeleton, SkeletonMatchCard } from "./Skeleton";

// Landing fallback: score cards + standing card + leaderboard list, matching the
// leading elements of Home.tsx (ScoreCards → StandingCard → Leaderboard).
export default function HomeLoading() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="grid gap-2 sm:grid-cols-2">
        <SkeletonMatchCard />
        <SkeletonMatchCard />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <Skeleton className="h-3 w-28" />
        <div className="mt-1.5 flex items-end justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="mt-2 h-4 w-2/3" />
        <div className="mt-3 border-t border-line-soft pt-2.5">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <ol className="space-y-2">
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
