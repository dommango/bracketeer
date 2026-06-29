import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/pool/access";
import { getChallengeKnockoutMatchDetail } from "@/lib/challenge/knockout-dashboard";
import { ChallengeMatchDetail } from "@/app/challenge/ChallengeMatchDetail";
import { ChallengeChat } from "@/app/challenge/ChallengeChat";

// Live results / lineups / odds change at request time.
export const dynamic = "force-dynamic";

export default async function KnockoutChallengeMatchPage({
  params,
}: {
  params: Promise<{ no: string }>;
}) {
  const { no } = await params;
  const matchNo = Number(no);
  if (!Number.isInteger(matchNo)) notFound();

  // Any real tournament match resolves here (team/venue drill-downs link in from
  // across the bracket); the wrapper returns null for unknown numbers and adds the
  // challenge field's pick-split + the viewer's own pick on scored knockout matches.
  const user = await getSessionUser();
  const detail = await getChallengeKnockoutMatchDetail(matchNo, user?.id ?? null);
  if (!detail) notFound();

  return (
    <>
      <ChallengeMatchDetail
        detail={detail}
        backHref="/challenge/knockout/matches"
        basePath="/challenge/knockout"
      />
      {detail.status === "LIVE" ? (
        <div className="mt-4">
          <ChallengeChat heading="Live chat" />
        </div>
      ) : null}
    </>
  );
}
