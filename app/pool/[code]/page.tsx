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

// Badge styling per tournament status: gold for upcoming, red for live, neutral for final.
const STATUS_BADGE: Record<string, string> = {
  UPCOMING: "bg-gold text-pitch-deep",
  LIVE: "bg-live text-white",
  COMPLETE: "bg-white/15 text-white",
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

      <header className="relative overflow-hidden rounded-3xl bg-pitch p-6 text-white shadow-[var(--shadow-md)]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/brand-26-pattern.avif)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.42,
            mixBlendMode: "luminosity",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,107,58,0.55) 0%, rgba(8,77,42,0.95) 100%)",
          }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold">
                {pool.tournamentName}
              </p>
              <h1 className="mt-1 break-words font-display text-[28px] leading-[1.05]">
                {pool.name}
              </h1>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${
                STATUS_BADGE[pool.tournamentStatus] ?? "bg-white/15 text-white"
              }`}
            >
              {pool.tournamentStatus === "LIVE" ? (
                <span className="h-1.5 w-1.5 rounded-full bg-current [animation:live-pulse_1.4s_ease-out_infinite]" />
              ) : null}
              {STATUS_LABEL[pool.tournamentStatus] ?? pool.tournamentStatus}
            </span>
          </div>

          <div className="mt-4 inline-flex flex-col rounded-md border border-white/20 bg-white/10 px-3.5 py-2.5 backdrop-blur">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/70">
              Join code
            </span>
            <span className="font-mono text-xl font-bold tracking-[0.1em]">
              {pool.joinCode}
              <span className="ml-2 text-xs font-medium tracking-normal text-white/70">
                {pool.leaderboard.length} {pool.leaderboard.length === 1 ? "entry" : "entries"}
              </span>
            </span>
          </div>

          <div className="mt-4 text-sm text-white/80">
            {sessionUser ? (
              <form action={signOutAction} className="flex items-center gap-2">
                <span className="truncate">
                  Signed in as {sessionUser.email ?? sessionUser.name}
                </span>
                <button className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/signin" className="font-semibold text-gold underline-offset-2 hover:underline">
                Sign in to claim your bracket &amp; chat →
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 mt-4 flex gap-1 overflow-x-auto rounded-full border border-line bg-white/90 p-1 backdrop-blur">
        {TABS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-surface-sunk"
          >
            {label}
          </a>
        ))}
      </nav>

      <section id="leaderboard" className="mt-6 scroll-mt-16">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Leaderboard
        </h2>
        <div className="mt-2.5">
          <Leaderboard rows={pool.leaderboard} youUserId={sessionUser?.id} />
        </div>
      </section>

      <section id="bracket" className="mt-8 scroll-mt-16">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Bracket</h2>
        <div className="mt-2.5">{bracket ? <Bracket view={bracket} code={pool.joinCode} /> : null}</div>
      </section>

      <section id="groups" className="mt-8 scroll-mt-16">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">
          Group standings
        </h2>
        <div className="mt-2.5">{bracket ? <GroupStandings view={bracket} /> : null}</div>
      </section>

      <section id="chat" className="mt-8 scroll-mt-16">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Chat</h2>
        <div className="mt-2.5">
          {isMember && sessionUser ? (
            <Chat poolId={pool.id} currentUserId={sessionUser.id} initialMessages={messages} />
          ) : (
            <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
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
