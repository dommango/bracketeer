import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolView, getPoolBracket } from "@/lib/pool/queries";
import { getPoolAccess, getSessionUser } from "@/lib/pool/access";
import { listMessages } from "@/lib/pool/chat";
import { signOutAction } from "@/lib/auth/actions";
import { Leaderboard } from "./Leaderboard";
import { Bracket, GroupStandings } from "./Bracket";
import { Chat } from "./Chat";
import { PoolRealtime } from "./PoolRealtime";

// Leaderboard + bracket are request-time (change as results come in).
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  LIVE: "Live",
  COMPLETE: "Final",
};

const TABS = [
  ["leaderboard", "Leaderboard"],
  ["bracket", "Bracket"],
  ["groups", "Groups"],
  ["chat", "Chat"],
] as const;

export default async function PoolPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolView(code);
  if (!pool) notFound();

  const [access, bracket] = await Promise.all([getPoolAccess(pool.id), getPoolBracket(pool.id)]);
  const sessionUser = access?.user ?? (await getSessionUser());
  const isMember = Boolean(access);
  const messages = isMember ? await listMessages(pool.id, 50) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <PoolRealtime poolId={pool.id} />

      <header className="rounded-2xl bg-pitch p-6 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-gold text-xs font-semibold uppercase tracking-wide">
              {pool.tournamentName}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold">{pool.name}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            {STATUS_LABEL[pool.tournamentStatus] ?? pool.tournamentStatus}
          </span>
        </div>
        <p className="mt-3 text-sm text-white/70">
          Join code <span className="font-mono font-semibold text-white">{pool.joinCode}</span>
          {" · "}
          {pool.leaderboard.length} {pool.leaderboard.length === 1 ? "entry" : "entries"}
        </p>
        <div className="mt-3 text-sm text-white/80">
          {sessionUser ? (
            <form action={signOutAction} className="flex items-center gap-2">
              <span className="truncate">Signed in as {sessionUser.email ?? sessionUser.name}</span>
              <button className="rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/signin" className="underline">
              Sign in to claim your bracket &amp; chat
            </Link>
          )}
        </div>
      </header>

      <nav className="sticky top-0 z-10 mt-4 flex gap-1 overflow-x-auto rounded-full bg-white/90 p-1 backdrop-blur">
        {TABS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5"
          >
            {label}
          </a>
        ))}
      </nav>

      <section id="leaderboard" className="mt-6 scroll-mt-16">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-black/50">
          Leaderboard
        </h2>
        <div className="mt-2">
          <Leaderboard rows={pool.leaderboard} />
        </div>
      </section>

      <section id="bracket" className="mt-8 scroll-mt-16">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-black/50">Bracket</h2>
        <div className="mt-2">{bracket ? <Bracket view={bracket} /> : null}</div>
      </section>

      <section id="groups" className="mt-8 scroll-mt-16">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-black/50">
          Group standings
        </h2>
        <div className="mt-2">{bracket ? <GroupStandings view={bracket} /> : null}</div>
      </section>

      <section id="chat" className="mt-8 scroll-mt-16">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-black/50">Chat</h2>
        <div className="mt-2">
          {isMember && sessionUser ? (
            <Chat poolId={pool.id} currentUserId={sessionUser.id} initialMessages={messages} />
          ) : (
            <p className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-center text-sm text-black/50">
              {sessionUser
                ? "Your account isn’t linked to an entry in this pool yet. Sign in with the email your bracket was imported under to join the chat."
                : "Sign in to join the pool chat."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
