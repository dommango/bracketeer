import { Skeleton } from "../../Skeleton";

export default function ProfileLoading() {
  return (
    <section className="space-y-4" aria-busy>
      <Skeleton className="ml-1 h-3 w-28" />
      <div className="rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-7 w-1/2" />
        <Skeleton className="mt-3 h-10 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </section>
  );
}
