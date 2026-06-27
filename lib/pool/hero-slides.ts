// Pure builder for the home hero carousel: which games are worth spotlighting
// right now, in featured-first order. Kept out of the component so the slide
// selection is unit-testable.

import type { PoolFormat } from "@/lib/pool/manage";
import { resolveGamePhase, featuredGame, md3DateRange } from "@/lib/pool/games";

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

// A game earns a slide only while it's actively recruiting picks/pools: MD3 while
// its picks are open, knockout while it can be created or its picks are open.
export function availableHeroSlides(now: Date = new Date()): HeroSlide[] {
  const slides: HeroSlide[] = [];

  const md3Phase = resolveGamePhase("MATCH_DAY_3_PICKEM", now).phase;
  if (md3Phase === "PICKS_OPEN" || md3Phase === "PICKS_CLOSING") {
    slides.push({
      format: "MATCH_DAY_3_PICKEM",
      href: "/challenge/md3",
      eyebrow: BRAND_EYEBROW,
      headline: "Match Day Pickem",
      stateLine: `Predict every Match Day 3 scoreline · ${md3DateRange()}`,
    });
  }

  const koPhase = resolveGamePhase("KNOCKOUT", now).phase;
  if (koPhase === "CREATE_ONLY" || koPhase === "PICKS_OPEN") {
    slides.push({
      format: "KNOCKOUT",
      href: "/challenge/knockout",
      eyebrow: BRAND_EYEBROW,
      headline: "Knockout Stage Bracket Games",
      stateLine: "Pool up with friends, or enter the global challenge",
    });
  }

  // Featured game first so the spotlight opens on whatever's most timely.
  const featured = featuredGame(now);
  if (featured) {
    slides.sort((a, b) => (a.format === featured ? -1 : b.format === featured ? 1 : 0));
  }
  return slides;
}
