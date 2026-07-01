import { Skeleton, SkeletonTabNav, SkeletonMatchCard } from "../Skeleton";

export default function MatchesLoading() {
  return (
    <div className="space-y-5" aria-busy>
      {/* View toggle (Groups / Knockouts / Scorers / Odds) */}
      <SkeletonTabNav count={4} />

      {/* Group standings */}
      <section>
        <Skeleton className="ml-1 h-3 w-32" />
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </section>

      {/* Group fixtures */}
      <section>
        <Skeleton className="ml-1 h-3 w-28" />
        <div className="mt-2.5">
          <SkeletonTabNav count={3} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonMatchCard key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
