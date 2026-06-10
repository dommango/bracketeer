import { notFound } from "next/navigation";
import { getPoolByCode, getHomeView } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { Home } from "./Home";

// Personalized landing — standing, today's mover, next match, chat teaser.
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
  const isMember = Boolean(access);

  const view = await getHomeView(pool.id, sessionUser?.id ?? null, isMember);

  return (
    <Home
      view={view}
      code={code}
      signedIn={Boolean(sessionUser)}
      startsAt={pool.tournament.startsAt.toISOString()}
      upcoming={pool.tournament.status === "UPCOMING"}
    />
  );
}
