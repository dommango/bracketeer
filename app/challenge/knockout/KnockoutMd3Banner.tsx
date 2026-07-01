import Link from "next/link";
import { resolveGamePhase, koPickemDateRange } from "@/lib/pool/games";

// A slim promo at the top of the Knockout Challenge home for the free Match Day
// Pick'em, now extended through the knockout rounds (R32 → Final). Self-hides once
// the pick'em is no longer joinable (phase leaves PICKS_OPEN/PICKS_CLOSING), so it
// quietly disappears when there's nothing left to pick. Links to the play form;
// MD3 is a separate public challenge, not part of the knockout bracket game.
export function KnockoutMd3Banner({ now }: { now: Date }) {
  const phase = resolveGamePhase("MATCH_DAY_3_PICKEM", now).phase;
  if (phase !== "PICKS_OPEN" && phase !== "PICKS_CLOSING") return null;

  const range = koPickemDateRange();

  return (
    <Link
      href="/challenge/md3/play"
      className="flex items-center gap-3 rounded-2xl border border-pitch/30 bg-pitch/5 px-4 py-3 transition-colors hover:bg-pitch/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
    >
      <span className="text-xl" aria-hidden="true">
        🎯
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">Match Day Pick’em</span>
          <span className="rounded-full bg-pitch px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
            Now through the knockouts
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
          Predict the exact scoreline of every knockout match, round by round
          {range ? ` · ${range}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-pitch">Play →</span>
    </Link>
  );
}
