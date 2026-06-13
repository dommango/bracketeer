import { Skeleton } from "../Skeleton";

export default function LeaderboardLoading() {
  return (
    <section aria-busy>
      <Skeleton className="ml-1 h-3 w-28" />
      <ol className="mt-2.5 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-8 shrink-0" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-6 w-12 shrink-0" />
            </div>
            <div className="mt-2 flex gap-1.5 pl-[76px]">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
