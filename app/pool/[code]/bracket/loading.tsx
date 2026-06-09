import { Skeleton } from "../Skeleton";

export default function BracketLoading() {
  return (
    <section aria-busy>
      <Skeleton className="ml-1 h-3 w-20" />
      <div className="mt-2.5 space-y-5">
        {Array.from({ length: 3 }).map((_, s) => (
          <div key={s}>
            <Skeleton className="mb-2 h-3 w-28" />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-md border border-line bg-surface p-3.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
