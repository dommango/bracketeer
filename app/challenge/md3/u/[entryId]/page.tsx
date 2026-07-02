import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/pool/access";
import { getTournamentIdBySlug, DEFAULT_TOURNAMENT_SLUG } from "@/lib/pool/queries";
import { getDailyKnockoutEntryView } from "@/lib/pool/daily-knockout-view";
import { getDailyKnockoutLeaderboard } from "@/lib/challenge/leaderboard";
import { DailyKnockoutBreakdown } from "../../DailyKnockoutBreakdown";

export const dynamic = "force-dynamic";

export default async function DailyKnockoutEntryPage({
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
    getDailyKnockoutEntryView(tournamentId, entryId, user?.id ?? null),
    getDailyKnockoutLeaderboard(),
  ]);
  if (!entry) notFound();

  const rank = board.find((r) => r.entryId === entryId)?.rank ?? null;

  return <DailyKnockoutBreakdown label={entry.label} view={entry.view} rank={rank} />;
}
