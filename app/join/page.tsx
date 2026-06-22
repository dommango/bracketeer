import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { normalizeJoinCode } from "@/lib/pool/join-code";
import { JoinPoolForm } from "./JoinPoolForm";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await getSessionUser();
  const { code } = await searchParams;
  const defaultCode = code ? (normalizeJoinCode(code) ?? "") : "";

  return (
    <main className="mx-auto max-w-[480px] px-5 pb-16 pt-12">
      <Link
        href="/"
        className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
      >
        ← Back
      </Link>

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
          Join a pool
        </p>
        <h1 className="mt-1.5 font-display text-[26px] leading-tight text-ink">
          Enter your join code
        </h1>
        <p className="mt-2 text-[13px] text-ink-3">
          A code works for any game — full tournament, Knockout Challenge, or Match Day 3 Pickem.
          Once you&apos;re in, the pool shows which game it plays and its current state (picks open,
          opens later, or locked). Joining also links any bracket imported under your email.
        </p>

        {user ? (
          <JoinPoolForm defaultCode={defaultCode} defaultDisplayName={user.name ?? ""} />
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line bg-surface-sunk p-5 text-center">
            <p className="text-sm text-ink-3">Sign in to join a pool.</p>
            <Link
              href="/signin"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-pitch px-5 font-semibold text-white transition-colors hover:bg-pitch-dark"
            >
              Sign in →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
