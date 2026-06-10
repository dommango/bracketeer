import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolView } from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { Leaderboard } from "../Leaderboard";

// Leaderboard is request-time (changes as results come in).
export const dynamic = "force-dynamic";

export default async function TablePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolView(code);
  if (!pool) notFound();

  const sessionUser = await getSessionUser();

  return (
    <section>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Leaderboard</h2>
        {pool.leaderboard.length >= 2 ? (
          <Link
            href={`/pool/${code}/compare`}
            className="text-xs font-semibold text-pitch hover:underline"
          >
            Compare brackets →
          </Link>
        ) : null}
      </div>
      <div className="mt-2.5">
        <Leaderboard rows={pool.leaderboard} youUserId={sessionUser?.id} code={code} />
      </div>
    </section>
  );
}
