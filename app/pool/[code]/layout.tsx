import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolHeader } from "@/lib/pool/queries";
import { getSessionUser, getPoolAccess } from "@/lib/pool/access";
import { signOutAction } from "@/lib/auth/actions";
import { PoolRealtime } from "./PoolRealtime";
import { BottomNav } from "./BottomNav";

// Hero reflects request-time session + entry count.
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

export default async function PoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await getPoolHeader(code);
  if (!pool) notFound();

  const sessionUser = await getSessionUser();
  const access = sessionUser ? await getPoolAccess(pool.id) : null;
  const isMember = Boolean(access);

  return (
    // Bottom padding clears the fixed bottom nav (plus iPhone home-bar inset).
    <div className="min-h-screen pb-[calc(72px+env(safe-area-inset-bottom))]">
      <PoolRealtime poolId={pool.id} />

      <main className="mx-auto max-w-2xl px-4 py-8">
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
                  {pool.entryCount} {pool.entryCount === 1 ? "entry" : "entries"}
                </span>
              </span>
            </div>

            <div className="mt-4 text-sm text-white/80">
              {sessionUser ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/account"
                    className="truncate font-medium underline-offset-2 hover:underline"
                  >
                    {sessionUser.email ?? sessionUser.name}
                  </Link>
                  <form action={signOutAction}>
                    <button className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25">
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/signin"
                  className="font-semibold text-gold underline-offset-2 hover:underline"
                >
                  Sign in to claim your bracket &amp; chat →
                </Link>
              )}
            </div>

            {sessionUser && !isMember ? (
              <Link
                href={`/join?code=${pool.joinCode}`}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-gold px-4 text-sm font-bold text-pitch-deep transition-colors hover:bg-gold-dark"
              >
                Join this pool →
              </Link>
            ) : null}
          </div>
        </header>

        <div className="mt-6">{children}</div>
      </main>

      <BottomNav code={code} />
    </div>
  );
}
