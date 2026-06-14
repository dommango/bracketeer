import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { signOutAction } from "@/lib/auth/actions";
import { Hero } from "./Hero";

// Session-aware landing. Signed-out visitors are funnelled to sign-in; signed-in
// visitors go straight to their pool (single membership) or a pools hub.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <SignedOut />;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: { id: true, role: true, pool: { select: { name: true, joinCode: true } } },
  });

  // Exactly one pool: skip the hub and drop the returning user into it.
  if (memberships.length === 1) {
    redirect(`/pool/${memberships[0].pool.joinCode}`);
  }

  return (
    <SignedInHub
      name={user.name ?? user.email ?? "there"}
      pools={memberships.map((m) => ({ name: m.pool.name, joinCode: m.pool.joinCode }))}
    />
  );
}

const PRIMARY_BTN =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.97]";
const SECONDARY_BTN =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface px-[18px] font-semibold text-pitch-dark transition-colors hover:bg-surface-sunk active:scale-[0.97]";

function SignedOut() {
  return (
    <main className="mx-auto max-w-[480px] px-5 pb-8 pt-12">
      <Hero />

      <div className="mt-6 rounded-3xl border border-line bg-surface p-[22px]">
        <h2 className="font-display text-lg text-ink">Sign in to get started</h2>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Claim your bracket, follow the live leaderboard, and join the group chat.
        </p>
        <Link href="/signin" className={`mt-4 ${PRIMARY_BTN}`}>
          Sign in →
        </Link>
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <h2 className="font-display text-lg text-ink">Running the pool?</h2>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Create a pool, share the code, and have everyone fill out their bracket.
        </p>
        <Link href="/pool/create" className={`mt-4 ${SECONDARY_BTN}`}>
          Create a pool
        </Link>
      </div>

      <Footer />
    </main>
  );
}

function SignedInHub({
  name,
  pools,
}: {
  name: string;
  pools: { name: string; joinCode: string }[];
}) {
  return (
    <main className="mx-auto max-w-[480px] px-5 pb-8 pt-12">
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

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <h2 className="font-display text-lg text-ink">
          {pools.length > 0 ? "Your pools" : "You’re not in a pool yet"}
        </h2>
        {pools.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {pools.map((p) => (
              <li key={p.joinCode}>
                <Link
                  href={`/pool/${p.joinCode}`}
                  className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-sunk"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{p.name}</span>
                    <span className="font-mono text-xs tracking-[0.1em] text-ink-3">
                      {p.joinCode}
                    </span>
                  </span>
                  <span className="font-display text-pitch-dark">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[13px] text-ink-3">
            Have a code from a friend? Join their pool — any bracket imported under your email
            links automatically.
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/join" className={pools.length > 0 ? SECONDARY_BTN : PRIMARY_BTN}>
          Join a pool
        </Link>
        <Link href="/pool/create" className={SECONDARY_BTN}>
          Create a pool
        </Link>
      </div>

      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <div className="mt-7 flex justify-center gap-2 text-[11px] text-ink-3">
      <span>FIFA World Cup 26™</span>
      <span>·</span>
      <span>June 11 – July 19, 2026</span>
    </div>
  );
}
