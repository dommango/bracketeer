import { notFound } from "next/navigation";
import {
  getTournamentIdBySlug,
  DEFAULT_TOURNAMENT_SLUG,
  getChallengeMatchDetail,
} from "@/lib/pool/queries";
import { getSessionUser } from "@/lib/pool/access";
import { getMd3ChallengeView } from "@/lib/pool/md3-view";
import { getDailyKnockoutView } from "@/lib/pool/daily-knockout-view";
import { isMd3MatchNo } from "@/lib/pool/match-day-3";
import { isDailyKnockoutMatchNo } from "@/lib/games/daily-pickem/scope";
import { ChallengeMatchDetail } from "@/app/challenge/ChallengeMatchDetail";
import { ChallengeChat } from "@/app/challenge/ChallengeChat";

// Live results / lineups / odds change at request time.
export const dynamic = "force-dynamic";

export default async function Md3ChallengeMatchPage({
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

  // Surface the viewer's own scoreline prediction — group fixtures from the MD3
  // view, knockout fixtures from the daily-knockout view. This page also resolves
  // matches with no pick (team/venue drill-downs), which simply show no prediction.
  let yourScore: { home: number; away: number; points: number | null } | null = null;
  const user = await getSessionUser();
  if (user && isMd3MatchNo(matchNo)) {
    const view = await getMd3ChallengeView(tournamentId, user.id);
    const f = view.fixtures.find((x) => x.matchNo === matchNo);
    if (f?.pred) yourScore = { home: f.pred.home, away: f.pred.away, points: f.points };
  } else if (user && isDailyKnockoutMatchNo(matchNo)) {
    const view = await getDailyKnockoutView(tournamentId, user.id);
    const f = view.fixtures.find((x) => x.matchNo === matchNo);
    if (f?.pred) yourScore = { home: f.pred.home, away: f.pred.away, points: f.points };
  }

  return (
    <>
      <ChallengeMatchDetail
        detail={detail}
        backHref="/challenge/md3/matches"
        basePath="/challenge/md3"
        yourScore={yourScore}
      />
      {detail.status === "LIVE" ? (
        <div className="mt-4">
          <ChallengeChat heading="Live chat" />
        </div>
      ) : null}
    </>
  );
}
