import { notFound } from "next/navigation";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { getPlayerDetail } from "@/lib/pool/player-detail";
import { ChallengePlayerDetail } from "@/app/challenge/ChallengePlayerDetail";

export const dynamic = "force-dynamic";

export default async function Md3ChallengePlayerPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: rawName } = await params;
  // A hand-crafted bad escape (e.g. "%E0%A4%A") would otherwise throw a 500.
  let name: string;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    notFound();
  }

  const tournamentId = await getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG);
  const detail = await getPlayerDetail(tournamentId, name);
  if (!detail) notFound();

  return <ChallengePlayerDetail detail={detail} basePath="/challenge/md3" />;
}
