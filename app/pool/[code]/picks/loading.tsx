import { Skeleton, SkeletonTabNav } from "../Skeleton";

export default function PicksLoading() {
  return (
    <section className="space-y-4" aria-busy>
      <div className="space-y-3">
        <SkeletonTabNav />
        <Skeleton className="ml-1 h-3 w-28" />
      </div>
      <Skeleton className="h-12 w-full rounded-2xl" />
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-4 w-16" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
