// Bracketeer-sponsored prize config for the public challenges. Pure data, no DB —
// so both client-safe copy surfaces (lib/pool/games.ts) and the server resolver
// (lib/challenge/prizes.ts) read the same source and can't drift. Phase 1 funds
// one fixed prize per public challenge; the amount is a placeholder the admin can
// confirm later (copy reads "a gift card", not a number).

import type { PoolFormat } from "@/lib/pool/manage";

// The challenge formats that carry a sponsored prize. A subset of PoolFormat —
// FULL_BRACKET has no public challenge / prize.
export type ChallengeFormat = "KNOCKOUT" | "MATCH_DAY_3_PICKEM";

export interface PrizeConfig {
  // Human description used verbatim in copy and stored on the PrizeAward.
  description: string;
  // Placeholder amount (minor units / currency left abstract for Phase 1). The
  // admin confirms the real figure at fulfillment time; null means "unset".
  amount: number | null;
  currency: string;
}

export const PRIZES: Record<ChallengeFormat, PrizeConfig> = {
  KNOCKOUT: { description: "a gift card", amount: null, currency: "GBP" },
  MATCH_DAY_3_PICKEM: { description: "a gift card", amount: null, currency: "GBP" },
};

export function isChallengeFormat(format: PoolFormat): format is ChallengeFormat {
  return format === "KNOCKOUT" || format === "MATCH_DAY_3_PICKEM";
}
