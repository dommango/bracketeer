import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolByCode } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { getMd3View } from "@/lib/pool/md3-view";
import { getMd3Entry } from "@/lib/pool/md3-picks";
import { isMd3EntryComplete } from "@/lib/challenge/eligibility";
import { Md3PicksForm } from "./Md3PicksForm";
import { Md3ChallengeToggle } from "./Md3ChallengeToggle";

// Picks change at request time as fixtures lock and results land.
export const dynamic = "force-dynamic";

export default async function Md3PicksPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();
  if (pool.format !== "MATCH_DAY_3_PICKEM") notFound();

  const sessionUser = await getSessionUser();
  const access = sessionUser ? await getPoolAccess(pool.id) : null;
  const view = await getMd3View(pool.tournament.id, pool.id, sessionUser?.id ?? null);

  // Challenge opt-in is available once the member has saved an entry.
  const md3Entry = access && sessionUser ? await getMd3Entry(pool.id, sessionUser.id) : null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between px-1">
        <div>
          <h2 className="font-display text-lg text-ink">Your picks</h2>
          <p className="text-[13px] text-ink-3">
            {view.pickedCount}/24 predicted · {view.openCount} still open
            {view.scoredCount > 0 ? ` · ${view.totalPoints} pts` : ""}
          </p>
        </div>
        <Link href={`/pool/${code}`} className="text-xs font-semibold text-pitch hover:underline">
          Leaderboard →
        </Link>
      </div>

      {!sessionUser ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
          <Link href="/signin" className="font-semibold text-pitch hover:underline">
            Sign in
          </Link>{" "}
          to make your picks.
        </p>
      ) : !access ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface-sunk p-4 text-center text-sm text-ink-3">
          <Link href={`/join?code=${pool.joinCode}`} className="font-semibold text-pitch hover:underline">
            Join this pool
          </Link>{" "}
          to make your picks.
        </p>
      ) : null}

      <Md3PicksForm code={code} fixtures={view.fixtures} canEdit={Boolean(access)} />

      {md3Entry ? (
        <Md3ChallengeToggle
          code={code}
          entered={md3Entry.enteredChallenge}
          complete={isMd3EntryComplete(md3Entry.scores)}
        />
      ) : null}
    </section>
  );
}
