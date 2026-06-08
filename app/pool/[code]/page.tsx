import { notFound } from "next/navigation";
import { getPoolView } from "@/lib/pool/queries";
import { Leaderboard } from "./Leaderboard";

// Leaderboard data is request-time (changes as results come in).
export const dynamic = "force-dynamic";

export default async function PoolPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolView(code);
  if (!pool) notFound();

  const statusLabel: Record<string, string> = {
    UPCOMING: "Upcoming",
    LIVE: "Live",
    COMPLETE: "Final",
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="rounded-2xl bg-pitch text-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-gold text-xs font-semibold uppercase tracking-wide">
              {pool.tournamentName}
            </p>
            <h1 className="text-2xl font-bold mt-0.5">{pool.name}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            {statusLabel[pool.tournamentStatus] ?? pool.tournamentStatus}
          </span>
        </div>
        <p className="mt-3 text-white/70 text-sm">
          Join code <span className="font-mono font-semibold text-white">{pool.joinCode}</span>
          {" · "}
          {pool.leaderboard.length} {pool.leaderboard.length === 1 ? "entry" : "entries"}
        </p>
      </header>

      <section className="mt-6">
        <h2 className="px-1 text-sm font-semibold text-black/50 uppercase tracking-wide">
          Leaderboard
        </h2>
        <div className="mt-2">
          <Leaderboard rows={pool.leaderboard} />
        </div>
      </section>
    </main>
  );
}
