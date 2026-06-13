import { notFound } from "next/navigation";
import { getPoolByCode, getHomeView, getPoolView } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { Home } from "./Home";

// Personalized landing: your standing, slim context strip (next match + mover),
// invite code, and the full leaderboard — the leaderboard is now the landing.
export const dynamic = "force-dynamic";

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

  const [view, poolView] = await Promise.all([
    getHomeView(pool.id, sessionUser?.id ?? null),
    getPoolView(code),
  ]);
  const leaderboard = poolView?.leaderboard ?? [];

  return (
    <Home
      view={view}
      leaderboard={leaderboard}
      youUserId={sessionUser?.id}
      code={code}
      signedIn={Boolean(sessionUser)}
      startsAt={pool.tournament.startsAt.toISOString()}
      upcoming={pool.tournament.status === "UPCOMING"}
      joinCode={pool.joinCode}
      entryCount={leaderboard.length}
    />
  );
}
