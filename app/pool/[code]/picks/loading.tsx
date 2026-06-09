import { Skeleton } from "../Skeleton";

export default function PicksLoading() {
  return (
    <section aria-busy>
      <Skeleton className="ml-1 h-3 w-28" />
      <Skeleton className="mt-3 h-10 w-full rounded-full" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border border-line bg-surface p-3">
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
