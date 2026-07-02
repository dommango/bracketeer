// Pure builder for the home hero carousel: which games are worth spotlighting
// right now, in featured-first order. Kept out of the component so the slide
// selection is unit-testable.

import type { PoolFormat } from "@/lib/pool/manage";
import { resolveGamePhase, featuredGame, koPickemDateRange } from "@/lib/pool/games";

// Constant brand line shown on every slide, so the Bracketeer identity stays
// anchored while the game-specific headline + line rotate beneath it.
const BRAND_EYEBROW = "BRACKETEER · WORLD CUP 2026";

export interface HeroSlide {
  format: PoolFormat;
  href: string;
  eyebrow: string;
  headline: string;
  stateLine: string;
}

// A game earns a slide while it's relevant — recruiting picks/pools OR live now:
// MD3 from picks-open through its live window, knockout from creatable through its
// live window. Surfacing the live state keeps the carousel pointing into each
// challenge's home instead of collapsing to the static hero once both games lock.
export function availableHeroSlides(now: Date = new Date()): HeroSlide[] {
  const slides: HeroSlide[] = [];

  const md3Phase = resolveGamePhase("MATCH_DAY_3_PICKEM", now).phase;
  if (md3Phase === "PICKS_OPEN" || md3Phase === "PICKS_CLOSING" || md3Phase === "LOCKED_LIVE") {
    slides.push({
      format: "MATCH_DAY_3_PICKEM",
      href: "/challenge/md3",
      eyebrow: BRAND_EYEBROW,
      headline: "Match Day Pickem",
      stateLine:
        md3Phase === "LOCKED_LIVE"
          ? "Live now · follow the leaderboard"
          : `Predict every knockout scoreline · free to play${
              koPickemDateRange() ? ` · ${koPickemDateRange()}` : ""
            }`,
    });
  }

  const koPhase = resolveGamePhase("KNOCKOUT", now).phase;
  if (koPhase === "CREATE_ONLY" || koPhase === "PICKS_OPEN" || koPhase === "LOCKED_LIVE") {
    slides.push({
      format: "KNOCKOUT",
      href: "/challenge/knockout",
      eyebrow: BRAND_EYEBROW,
      headline: "Knockout Stage Bracket Games",
      stateLine:
        koPhase === "LOCKED_LIVE"
          ? "Brackets locked · follow the live leaderboard"
          : "Pool up with friends, or enter the global challenge",
    });
  }

  // Most-relevant game first: the featured (recruiting) game, otherwise the current
  // live stage — knockout once MD3's joinable window has passed.
  const primary =
    featuredGame(now) ??
    (resolveGamePhase("MATCH_DAY_3_PICKEM", now).joinable ? "MATCH_DAY_3_PICKEM" : "KNOCKOUT");
  slides.sort((a, b) => (a.format === primary ? -1 : b.format === primary ? 1 : 0));
  return slides;
}
