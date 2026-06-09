import { Skeleton } from "../../Skeleton";

export default function MatchDetailLoading() {
  return (
    <section className="space-y-4" aria-busy>
      <Skeleton className="ml-1 h-3 w-40" />
      <div className="rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-6 w-2/3" />
        <Skeleton className="mt-3 h-6 w-2/3" />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-2 w-full" />
        <Skeleton className="mt-2 h-2 w-4/5" />
      </div>
    </section>
  );
}
