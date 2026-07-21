import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode, getPoolView, getPoolProjection } from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { cutoverAppliesTo, cutoverByEntry, isCutoverActive } from "@/lib/pool/cutover";
import { Leaderboard } from "../Leaderboard";
import { ProjectedFinish } from "../ProjectedFinish";
import { BracketsTabNav } from "../BracketsTabNav";
import { ScoringChangeBanner } from "../ScoringChangeBanner";

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

  const [sessionUser, poolView, projection] = await Promise.all([
    getSessionUser(),
    getPoolView(code),
    getPoolProjection(pool.id),
  ]);
  const baseRows = poolView?.leaderboard ?? [];

  // Attach each entry's cutover move so the leaderboard can show the per-row
  // "moved at the scoring change" chip — only on the pool the audit record
  // describes, and only while the cutover window is open.
  const showCutover = cutoverAppliesTo(pool.id) && isCutoverActive();
  const leaderboard = showCutover
    ? baseRows.map((r) => {
        const move = cutoverByEntry.get(r.entryId);
        return move ? { ...r, cutover: move } : r;
      })
    : baseRows;

  return (
    <section className="space-y-4">
      <BracketsTabNav code={code} />
      {showCutover ? <ScoringChangeBanner code={code} /> : null}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Leaderboard
          <span className="ml-1.5 font-medium normal-case tracking-normal text-ink-4">
            {leaderboard.length} {leaderboard.length === 1 ? "entry" : "entries"}
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <Link
            href={`/pool/${code}/scoring`}
            className="text-xs font-semibold text-pitch hover:underline"
          >
            Scoring
          </Link>
          {leaderboard.length >= 2 ? (
            <Link
              href={`/pool/${code}/compare`}
              className="text-xs font-semibold text-pitch hover:underline"
            >
              Compare brackets →
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5">
        <Leaderboard
          rows={leaderboard}
          youUserId={sessionUser?.id}
          code={code}
          showMedals={poolView?.groupStageComplete ?? false}
        />
      </div>
      <ProjectedFinish projection={projection} youUserId={sessionUser?.id} />
    </section>
  );
}
