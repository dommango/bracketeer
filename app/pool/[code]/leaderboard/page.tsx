import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getPoolView } from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { Leaderboard } from "../Leaderboard";

// Standings change at request time as results land.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const [sessionUser, poolView] = await Promise.all([getSessionUser(), getPoolView(code)]);
  const leaderboard = poolView?.leaderboard ?? [];

  return (
    <section>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Leaderboard
          <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
            {leaderboard.length} {leaderboard.length === 1 ? "entry" : "entries"}
          </span>
        </h2>
        {leaderboard.length >= 2 ? (
          <Link
            href={`/pool/${code}/compare`}
            className="text-xs font-semibold text-pitch hover:underline"
          >
            Compare brackets →
          </Link>
        ) : null}
      </div>
      <div className="mt-2.5">
        <Leaderboard rows={leaderboard} youUserId={sessionUser?.id} code={code} />
      </div>
    </section>
  );
}
