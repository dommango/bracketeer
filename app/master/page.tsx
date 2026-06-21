import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { getMasterLeaderboard } from "@/lib/master/leaderboard";

export const dynamic = "force-dynamic";

export default async function MasterLeaderboardPage() {
  const [rows, user] = await Promise.all([getMasterLeaderboard(), getSessionUser()]);

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-ink">Master knockout tournament</h1>
        <p className="text-sm text-ink-3">
          Every solo bracket entered into the global tournament, ranked together.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink-2">No entries yet</p>
          <p className="mt-1.5 text-sm text-ink-3">Be the first to enter the tournament.</p>
          <Link
            href="/bracket"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
          >
            Build your bracket →
          </Link>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((row) => {
            const mine = user?.id && row.userId === user.id;
            return (
              <li
                key={row.entryId}
                className={`flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3 last:border-b-0 ${
                  mine ? "bg-pitch-tint" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-ink-3">
                    {row.rank}
                  </span>
                  <span className="truncate font-semibold text-ink">
                    {row.label}
                    {mine ? <span className="ml-1.5 text-xs font-normal text-pitch-dark">you</span> : null}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
                  {row.total}
                  {row.projected ? (
                    <span className="ml-1 text-xs text-positive">▲{row.projected}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <Link
        href="/bracket"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
      >
        <span className="text-sm font-semibold text-ink">Your bracket</span>
        <span className="font-display text-pitch-dark">→</span>
      </Link>
    </section>
  );
}
