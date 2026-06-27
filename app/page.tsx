import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { signOutAction } from "@/lib/auth/actions";
import type { PoolFormat } from "@/lib/pool/manage";
import { resolveGamePhase } from "@/lib/pool/games";
import { PublicGames } from "./PublicGames";
import { SignInPanel } from "./signin/SignInPanel";
import { StartAPoolPromo } from "./StartAPoolPromo";
import { Footer } from "./Footer";
import { HeroCarousel } from "./HeroCarousel";

// Session-aware landing. Signed-out visitors get the sign-in / register panel
// directly; signed-in visitors go straight to their pool (single membership) or
// a pools hub. (A dedicated marketing landing page comes later.)
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <SignInPanel dest="/" />;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: { id: true, role: true, pool: { select: { name: true, joinCode: true, format: true } } },
  });

  // Exactly one pool: skip the hub and drop the returning user into it.
  if (memberships.length === 1) {
    redirect(`/pool/${memberships[0].pool.joinCode}`);
  }

  return (
    <SignedInHub
      name={user.name ?? user.email ?? "there"}
      pools={memberships.map((m) => ({
        name: m.pool.name,
        joinCode: m.pool.joinCode,
        format: m.pool.format as PoolFormat,
      }))}
    />
  );
}

const SECONDARY_BTN =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface px-[18px] font-semibold text-pitch-dark transition-colors hover:bg-surface-sunk active:scale-[0.97]";

function PoolStateBadge({ format, now }: { format: PoolFormat; now: Date }) {
  const label = resolveGamePhase(format, now).label;
  return (
    <span className="shrink-0 rounded-full bg-surface-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-2">
      {label}
    </span>
  );
}

function SignedInHub({
  name,
  pools,
}: {
  name: string;
  pools: { name: string; joinCode: string; format: PoolFormat }[];
}) {
  const now = new Date();
  return (
    <main className="mx-auto max-w-2xl px-5 pb-8 pt-12">
      <div className="flex items-center justify-between">
        <p className="truncate text-[13px] text-ink-3">
          Signed in as <span className="font-semibold text-ink-2">{name}</span>
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-surface-sunk px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-4">
        <HeroCarousel now={now} />
      </div>

      <PublicGames now={now} />

      {pools.length > 0 ? (
        <div className="mt-4 rounded-3xl border border-line bg-pitch/[0.03] p-[22px]">
          <h2 className="font-display text-lg text-ink">Your pools</h2>
          <ul className="mt-4 space-y-2">
            {pools.map((p) => (
              <li key={p.joinCode}>
                <Link
                  href={`/pool/${p.joinCode}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{p.name}</span>
                    <span className="font-mono text-xs tracking-[0.1em] text-ink-3">
                      {p.joinCode}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <PoolStateBadge format={p.format} now={now} />
                    <span className="font-display text-pitch-dark">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/join" className={SECONDARY_BTN}>
              Join a pool
            </Link>
            <Link href="/pool/create" className={SECONDARY_BTN}>
              Create a pool
            </Link>
          </div>
        </div>
      ) : (
        <StartAPoolPromo now={now} />
      )}

      <Footer />
    </main>
  );
}
