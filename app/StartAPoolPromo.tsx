import Link from "next/link";
import { GAME_CATALOG, gameStateLine } from "@/lib/pool/games";

const PRIMARY_BTN =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.97]";

// Shown when the viewer isn't in any pool yet (on the hub and the sign-in panel):
// a full promo for running your own private Knockout Stage Pool with friends —
// distinct from the public Knockout Challenge (this is the create-and-invite,
// play-with-your-group game).
export function StartAPoolPromo({ now }: { now: Date }) {
  const game = GAME_CATALOG.KNOCKOUT;
  return (
    <div className="mt-4 rounded-3xl border border-line bg-surface p-[22px]">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-pitch-dark">
        Knockout Stage Bracket Games · with friends
      </p>
      <h2 className="mt-1 font-display text-xl text-ink">{game.poolName}</h2>
      <p className="mt-2 text-[13px] text-ink-3">{game.blurb}</p>
      <p className="mt-2 text-[13px] font-semibold text-pitch-dark">
        {gameStateLine("KNOCKOUT", now)}
      </p>
      <Link href="/pool/create?game=knockout" className={`mt-3 ${PRIMARY_BTN}`}>
        Create a pool →
      </Link>
      <p className="mt-3 text-center text-[12px] text-ink-3">
        Have a code from a friend?{" "}
        <Link href="/join" className="font-semibold text-pitch-dark hover:underline">
          Join a pool
        </Link>{" "}
        — any bracket imported under your email connects automatically.
      </p>
    </div>
  );
}
