import { notFound } from "next/navigation";
import { getPoolByCode, getHomeView, getPoolView, getPoolBracket } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { listMessages } from "@/lib/pool/chat";
import { Home } from "./Home";

// Personal dashboard: live scores, your standing(s), stats, the next match, and a
// truncated leaderboard (full list lives at /pool/[code]/leaderboard).
export const dynamic = "force-dynamic";

const TOP_N = 5;

export default async function PoolHomePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolByCode(code);
  if (!pool) notFound();

  const access = await getPoolAccess(pool.id);
  const sessionUser = access?.user ?? (await getSessionUser());

  const [view, poolView, bracket, recentChat] = await Promise.all([
    getHomeView(pool.id, sessionUser?.id ?? null),
    getPoolView(code),
    getPoolBracket(pool.id),
    // Chat is members-only — fetch the latest few only for users with access.
    access ? listMessages(pool.id, 3, sessionUser?.id ?? null) : Promise.resolve([]),
  ]);
  const fullBoard = poolView?.leaderboard ?? [];

  // Top N, plus the viewer's own *best* row when it ranks below the cut so they
  // always see themselves without opening the full leaderboard. Their other
  // brackets (if any) surface separately via view.otherEntries.
  const topRows = fullBoard.slice(0, TOP_N);
  const yourRow = sessionUser ? fullBoard.find((r) => r.userId === sessionUser.id) : undefined;
  const leaderboard =
    yourRow && yourRow.rank > TOP_N ? [...topRows, yourRow] : topRows;
  const hasMore = fullBoard.length > TOP_N;

  return (
    <Home
      view={view}
      leaderboard={leaderboard}
      youUserId={sessionUser?.id}
      code={code}
      signedIn={Boolean(sessionUser)}
      startsAt={pool.tournament.startsAt.toISOString()}
      upcoming={new Date() < pool.tournament.startsAt}
      entryCount={fullBoard.length}
      hasMore={hasMore}
      bracket={bracket}
      showMedals={poolView?.groupStageComplete ?? false}
      recentChat={recentChat}
      format={pool.format}
    />
  );
}
