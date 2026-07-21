import Link from "next/link";
import { cutoverSummary, isCutoverActive } from "@/lib/pool/cutover";

// Leaderboard notice announcing the placement-agnostic scoring change, linking to
// the full statement. Self-hides once the cutover window closes (see
// lib/pool/cutover.ts) — the rule stays, but the announcement retires and the
// board reads as the new normal. Mirrors Md3PoolBanner's shape.
export function ScoringChangeBanner({ code, now = new Date() }: { code: string; now?: Date }) {
  if (!isCutoverActive(now)) return null;
  const { gained, total } = cutoverSummary();

  return (
    <Link
      href={`/pool/${code}/scoring`}
      className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold-tint px-4 py-3 transition-colors hover:bg-gold-tint/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
    >
      <span className="text-xl" aria-hidden="true">
        📋
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-ink">Statement from the Commissioner</span>
          <span className="rounded-full bg-pitch px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
            Important Update
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
          Knockout picks now score placement-agnostically · {gained} of {total} brackets moved
        </span>
      </span>
      <span className="shrink-0 text-[13px] font-semibold text-pitch">Read why →</span>
    </Link>
  );
}
