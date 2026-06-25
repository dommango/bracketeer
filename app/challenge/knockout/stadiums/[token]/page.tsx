import { notFound } from "next/navigation";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { getStadium } from "@/lib/pool/stadiums";
import { getChallengeVenueSections } from "@/lib/challenge/venue";
import { ChallengeStadiumDetail } from "@/app/challenge/ChallengeStadiumDetail";

export const dynamic = "force-dynamic";

export default async function KnockoutChallengeStadiumPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const stadium = getStadium(token);
  if (!stadium) notFound();

  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const sections = await getChallengeVenueSections(tournamentId, token);

  return (
    <ChallengeStadiumDetail stadium={stadium} sections={sections} basePath="/challenge/knockout" />
  );
}
