import { notFound } from "next/navigation";
import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getChallengeMatchDetail,
} from "@/lib/pool/queries";
import { ChallengeMatchDetail } from "@/app/challenge/ChallengeMatchDetail";

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
  // across the bracket); getChallengeMatchDetail returns null for unknown numbers.
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const detail = await getChallengeMatchDetail(tournamentId, matchNo);
  if (!detail) notFound();

  return (
    <ChallengeMatchDetail
      detail={detail}
      backHref="/challenge/knockout/matches"
      basePath="/challenge/knockout"
    />
  );
}
