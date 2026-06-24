// Bracketeer-sponsored prize config for the public challenges. Pure data + a pure
// amount function, no DB — so both client-safe copy surfaces (lib/pool/games.ts)
// and the server resolver (lib/challenge/prizes.ts) read the same source and can't
// drift. Two shapes: a FIXED prize (flat amount) and a SCALED prize (grows with the
// number of eligible entrants, bounded by a floor and a cap).

import type { PoolFormat } from "@/lib/pool/manage";

// The challenge formats that carry a sponsored prize. A subset of PoolFormat —
// FULL_BRACKET has no public challenge / prize.
export type ChallengeFormat = "KNOCKOUT" | "MATCH_DAY_3_PICKEM";

// A flat prize: the same amount regardless of entrant count.
export interface FixedPrizeConfig {
  kind: "fixed";
  description: string;
  amount: number;
  currency: string;
}

// A prize that scales with eligible entrants: amount = clamp(perEntrant * N, min, max).
export interface ScaledPrizeConfig {
  kind: "scaled";
  description: string;
  perEntrant: number;
  min: number;
  max: number;
  currency: string;
}

export type PrizeConfig = FixedPrizeConfig | ScaledPrizeConfig;

export const PRIZES: Record<ChallengeFormat, PrizeConfig> = {
  // Scales with entries: $1 per eligible entrant, floor $50, cap $250.
  // (50 entrants → $50, 100 → $100, 250+ → $250.)
  KNOCKOUT: {
    kind: "scaled",
    description: "a gift card",
    perEntrant: 1,
    min: 50,
    max: 250,
    currency: "USD",
  },
  // Flat $50 gift card.
  MATCH_DAY_3_PICKEM: {
    kind: "fixed",
    description: "a $50 gift card",
    amount: 50,
    currency: "USD",
  },
};

// Resolve the concrete prize amount for a challenge given the final eligible
// entrant count. Pure + deterministic so it can be unit-tested and reproduced.
export function computePrizeAmount(config: PrizeConfig, entrantCount: number): number {
  if (config.kind === "fixed") return config.amount;
  const scaled = config.perEntrant * Math.max(0, entrantCount);
  return Math.min(config.max, Math.max(config.min, scaled));
}

export function isChallengeFormat(format: PoolFormat): format is ChallengeFormat {
  return format === "KNOCKOUT" || format === "MATCH_DAY_3_PICKEM";
}
