import Link from "next/link";
import { resolveGamePhase, md3DateRange } from "@/lib/pool/games";

// A slim promo for the public Match Day Pickem challenge, shown across a pool's
// tabs while the game is still playable. Self-hides once every MD3 fixture has
// kicked off (phase leaves PICKS_OPEN/PICKS_CLOSING) — i.e. it's gone the moment
// there's nothing left to pick, so it quietly disappears when the game is done.
// Links straight to the play form; MD3 is a separate public challenge, not a pool.
export function Md3PoolBanner({ now }: { now: Date }) {
  const phase = resolveGamePhase("MATCH_DAY_3_PICKEM", now).phase;
  if (phase !== "PICKS_OPEN" && phase !== "PICKS_CLOSING") return null;

  return (
    <Link
      href="/challenge/md3/play"
      className="mt-6 flex items-center gap-3 rounded-2xl border border-pitch/30 bg-pitch/5 px-4 py-3 transition-colors hover:bg-pitch/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
    >
      <span className="text-xl" aria-hidden="true">
        🎯
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">Match Day Pickem</span>
          <span className="rounded-full bg-pitch px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
            Live now
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
          Predict the final group-stage scorelines · {md3DateRange()}
        </span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-pitch">Play →</span>
    </Link>
  );
}
