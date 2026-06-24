import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/pool/access";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { getMd3EntryView } from "@/lib/pool/md3-view";
import { getMd3ChallengeLeaderboard } from "@/lib/challenge/leaderboard";
import { Md3PickBreakdown } from "../../Md3PickBreakdown";

export const dynamic = "force-dynamic";

export default async function Md3ChallengeEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const [tournamentId, user] = await Promise.all([
    getTournamentIdBySlug(DEFAULT_TOURNAMENT_SLUG),
    getSessionUser(),
  ]);
  const [entry, board] = await Promise.all([
    // Another player's scorelines stay hidden per fixture until kickoff; the
    // owner sees their own. Points/standing remain public on the board.
    getMd3EntryView(tournamentId, entryId, user?.id ?? null),
    getMd3ChallengeLeaderboard(),
  ]);
  if (!entry) notFound();

  const rank = board.find((r) => r.entryId === entryId)?.rank ?? null;

  return <Md3PickBreakdown label={entry.label} view={entry.view} rank={rank} />;
}
