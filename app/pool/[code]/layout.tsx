import Link from "next/link";
import { notFound } from "next/navigation";
import { getPoolHeader } from "@/lib/pool/queries";
import { getSessionUser, getPoolAccess, canManagePool } from "@/lib/pool/access";
import { signOutAction } from "@/lib/auth/actions";
import { PoolRealtime } from "./PoolRealtime";
import { BottomNav } from "./BottomNav";
import { Footer } from "../../Footer";

// Hero reflects request-time session + entry count.
export const dynamic = "force-dynamic";

// Buttons floating over the hero artwork share the frosted-dark vocabulary.
const FROSTED_BUTTON: React.CSSProperties = {
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,0.28)",
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
  const canManage = canManagePool(access);

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
            }}
          />
          {/* Scrim stack: a flat tint floors contrast on any artwork, then a
              top-anchored gradient darkens exactly where the (top-left) text
              sits — the old gradient only darkened the bottom, where nothing is. */}
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.34)" }} />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(155deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0) 70%), linear-gradient(0deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 35%)",
            }}
          />
          <div className="relative">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                {pool.tournamentName}
              </p>
              <h1 className="mt-1 break-words font-display text-[28px] leading-[1.05] [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                {pool.name}
              </h1>
            </div>

            <div className="mt-4 text-sm text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]">
              {sessionUser ? (
                <Link
                  href="/account"
                  className="block truncate font-medium underline-offset-2 hover:underline"
                >
                  {sessionUser.email ?? sessionUser.name}
                </Link>
              ) : (
                <Link
                  href="/signin"
                  className="font-semibold text-gold underline-offset-2 hover:underline"
                >
                  Sign in to claim your bracket &amp; chat →
                </Link>
              )}
            </div>

            {/* Action buttons share one size and sit on the same row. */}
            {sessionUser ? (
              <div className="mt-3 flex items-center gap-2">
                {canManage ? (
                  <Link
                    href={`/pool/${code}/manage`}
                    className="inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold text-white transition-colors hover:bg-black/60"
                    style={FROSTED_BUTTON}
                  >
                    Manage pool
                  </Link>
                ) : null}
                <form action={signOutAction}>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold text-white transition-colors hover:bg-black/60"
                    style={FROSTED_BUTTON}
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}

            {sessionUser && !isMember ? (
              <Link
                href={`/join?code=${pool.joinCode}`}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-gold px-4 text-sm font-bold text-pitch-deep transition-colors hover:bg-gold-dark"
              >
                Join this pool →
              </Link>
            ) : null}
          </div>
        </header>

        <div className="mt-6">{children}</div>

        <Footer />
      </main>

      <BottomNav code={code} />
    </div>
  );
}
