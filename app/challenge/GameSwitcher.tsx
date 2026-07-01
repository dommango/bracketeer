"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PoolFormat } from "@/lib/pool/manage";
import { resolveGamePhase } from "@/lib/pool/games";
import { challengeBaseFromPath, switchGameHref, type GameSlug } from "@/lib/challenge/nav";

const SEGMENTS: { slug: GameSlug; format: PoolFormat; label: string }[] = [
  { slug: "md3", format: "MATCH_DAY_3_PICKEM", label: "Match Day Pickem" },
  { slug: "knockout", format: "KNOCKOUT", label: "Knockout Challenge" },
];

// A two-segment pill that switches between the public challenges, rendered under
// each game's hero. A game shows only while it's active (neither upcoming nor
// complete); with fewer than two active games there's nothing to switch between,
// so it renders nothing. `now` comes from the server layout for stable SSR.
export function GameSwitcher({ now }: { now: Date }) {
  const pathname = usePathname() ?? "";
  const active = challengeBaseFromPath(pathname);

  const visible = SEGMENTS.filter((s) => {
    const phase = resolveGamePhase(s.format, now).phase;
    return phase !== "UPCOMING" && phase !== "COMPLETE";
  });
  if (visible.length < 2) return null;

  return (
    <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
      {visible.map((s) => {
        const isActive = active === `/challenge/${s.slug}`;
        return (
          <Link
            key={s.slug}
            href={switchGameHref(pathname, s.slug)}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-3 py-2 text-center text-[13px] font-semibold transition-colors ${
              isActive
                ? "bg-pitch-tint text-pitch-dark shadow-[inset_0_0_0_1px_var(--color-gold)]"
                : "text-ink-3 hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
