import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/pool/access";
import { isInviteValid } from "@/lib/pool/invite-token";
import { AcceptButton } from "./AcceptButton";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.poolInvite.findUnique({
    where: { token },
    select: { acceptedAt: true, expiresAt: true, pool: { select: { name: true } } },
  });
  const valid = invite ? isInviteValid(invite) : false;
  const user = await getSessionUser();

  return (
    <main className="mx-auto max-w-[480px] px-5 pb-8 pt-12">
      <div className="rounded-3xl border border-line bg-surface p-6 text-center">
        {!invite || !valid ? (
          <>
            <h1 className="font-display text-2xl text-ink">Invite unavailable</h1>
            <p className="mt-2 text-sm text-ink-3">
              This invite link is invalid, has expired, or has already been used. Ask the pool
              owner for a fresh link or join code.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
            >
              Go home →
            </Link>
          </>
        ) : !user ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
              You&apos;re invited
            </p>
            <h1 className="mt-1.5 font-display text-2xl text-ink">{invite.pool.name}</h1>
            <p className="mt-2 text-sm text-ink-3">Sign in to accept your invite and join the pool.</p>
            <Link
              href={`/signin?callbackUrl=/invite/${encodeURIComponent(token)}`}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white hover:bg-pitch-dark"
            >
              Sign in to join →
            </Link>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
              You&apos;re invited
            </p>
            <h1 className="mt-1.5 font-display text-2xl text-ink">{invite.pool.name}</h1>
            <p className="mt-2 mb-4 text-sm text-ink-3">
              Accept to join the pool and start making your picks.
            </p>
            <AcceptButton token={token} />
          </>
        )}
      </div>
    </main>
  );
}
