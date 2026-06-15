import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import type { PoolFormat } from "@/lib/pool/manage";
import { CreatePoolForm } from "./CreatePoolForm";
import { Hero } from "../../Hero";

export const dynamic = "force-dynamic";

export default async function CreatePoolPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const user = await getSessionUser();
  const { game } = await searchParams;
  const defaultFormat: PoolFormat = game === "knockout" ? "KNOCKOUT" : "FULL_BRACKET";
  const knockout = defaultFormat === "KNOCKOUT";

  return (
    <main className="mx-auto max-w-[480px] px-5 pb-16 pt-12">
      <Link
        href="/"
        className="text-[13px] font-semibold text-pitch-dark underline-offset-2 hover:underline"
      >
        ← Back
      </Link>

      <div className="mt-4">
        <Hero />
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
          New pool
        </p>
        <h1 className="mt-1.5 font-display text-[26px] leading-tight text-ink">
          {knockout ? "Start a Knockout Challenge" : "Start a World Cup 2026 pool"}
        </h1>
        <p className="mt-2 text-[13px] text-ink-3">
          {knockout
            ? "Predict the knockout bracket against your friends. You'll get a join code to share — picks open when the last 32 are set."
            : "You'll get a join code to share. Friends sign in, join, and fill out their bracket right here."}
        </p>

        {user ? (
          <CreatePoolForm defaultDisplayName={user.name ?? ""} defaultFormat={defaultFormat} />
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line bg-surface-sunk p-5 text-center">
            <p className="text-sm text-ink-3">Sign in to create a pool.</p>
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
