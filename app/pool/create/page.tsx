import Link from "next/link";
import { getSessionUser } from "@/lib/pool/access";
import { hasTournamentStarted } from "@/lib/pool/queries";
import type { PoolFormat } from "@/lib/pool/manage";
import { isMd3GameOpen } from "@/lib/pool/match-day-3";
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
  // Once the tournament has started the full-tournament game is closed, so the
  // page leads with the Knockout Challenge regardless of the requested format.
  const fullGameAvailable = !(await hasTournamentStarted());
  const md3Available = isMd3GameOpen();
  const defaultFormat: PoolFormat =
    game === "md3" && md3Available
      ? "MATCH_DAY_3_PICKEM"
      : game === "knockout" || !fullGameAvailable
        ? "KNOCKOUT"
        : "FULL_BRACKET";
  const knockout = defaultFormat === "KNOCKOUT";
  const md3 = defaultFormat === "MATCH_DAY_3_PICKEM";

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
          {md3
            ? "Start a Match Day 3 Pickem"
            : knockout
              ? "Start a Knockout Challenge"
              : "Start a World Cup 2026 pool"}
        </h1>
        <p className="mt-2 text-[13px] text-ink-3">
          {md3
            ? "Predict the score of every final group-stage match. You'll get a join code to share — each pick locks at its kickoff."
            : knockout
              ? "Predict the knockout bracket against your friends. You'll get a join code to share — picks open when the last 32 are set."
              : "You'll get a join code to share. Friends sign in, join, and fill out their bracket right here."}
        </p>

        {user ? (
          <CreatePoolForm
            defaultDisplayName={user.name ?? ""}
            defaultFormat={defaultFormat}
            fullGameAvailable={fullGameAvailable}
            md3Available={md3Available}
          />
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
