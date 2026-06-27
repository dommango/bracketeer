// KNOCKOUT game module — the standalone Knockout Challenge, seeded from the real
// 32 qualifiers and scored on the knockout rounds only. Shares the bracket oracle
// scoring (bracketScoreEntries); locks at the Round-of-32 kickoff via the
// knockout-specific lock helper rather than the tournament start.

import { R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";
import { isKnockoutLocked } from "@/lib/pool/knockout";
import { bracketScoreEntries } from "./bracket-score";
import type { GameModule } from "./types";

const KNOCKOUT_IDS = [...R32, ...R16, ...QF, ...SF, FINAL].map((m) => m.id);

export const knockoutModule: GameModule = {
  format: "KNOCKOUT",
  ownsSections: [
    "round_of_32",
    "round_of_16",
    "quarterfinals",
    "semifinals",
    "final",
    "player_awards",
  ],
  matchNos: () => [...KNOCKOUT_IDS],
  isLocked: ({ locksAt, entryLocked = false, now = new Date() }) =>
    isKnockoutLocked(locksAt, entryLocked, now),
  scoreEntries: bracketScoreEntries,
  // Label-free: rank on total alone; the caller breaks display ties by label.
  compareForRank: (a, b) => b.total - a.total,
};
