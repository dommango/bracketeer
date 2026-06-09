import { Skeleton, SkeletonCard } from "./Skeleton";

// Home dashboard fallback.
export default function HomeLoading() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-10 w-40" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
