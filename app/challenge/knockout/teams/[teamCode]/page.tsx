import { notFound } from "next/navigation";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { getChallengeTeamDetail } from "@/lib/pool/team-detail";
import { ChallengeTeamDetail } from "@/app/challenge/ChallengeTeamDetail";

export const dynamic = "force-dynamic";

export default async function KnockoutChallengeTeamPage({
  params,
}: {
  params: Promise<{ teamCode: string }>;
}) {
  const { teamCode } = await params;
  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const detail = await getChallengeTeamDetail(tournamentId, teamCode.toUpperCase());
  if (!detail) notFound();

  return <ChallengeTeamDetail detail={detail} basePath="/challenge/knockout" />;
}
