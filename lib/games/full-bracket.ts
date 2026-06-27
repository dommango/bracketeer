// FULL_BRACKET game module — the whole tournament, group stage through final,
// scored byte-for-byte against the answer key via the parity oracle. Delegates
// scoring to the shared bracketScoreEntries; locks at the tournament kickoff.

import { R32, R16, QF, SF, FINAL } from "@/lib/scoring/data";
import { arePicksLocked } from "@/lib/pool/lock";
import { bracketScoreEntries } from "./bracket-score";
import type { GameModule } from "./types";

const GROUP_IDS = Array.from({ length: 72 }, (_, i) => i + 1);
const KNOCKOUT_IDS = [...R32, ...R16, ...QF, ...SF, FINAL].map((m) => m.id);

export const fullBracketModule: GameModule = {
  format: "FULL_BRACKET",
  ownsSections: [
    "group_stage",
    "third_place_advancers",
    "round_of_32",
    "round_of_16",
    "quarterfinals",
    "semifinals",
    "final",
    "player_awards",
  ],
  matchNos: () => [...GROUP_IDS, ...KNOCKOUT_IDS],
  isLocked: ({ locksAt, entryLocked = false, now = new Date() }) =>
    locksAt ? arePicksLocked(locksAt, entryLocked, now) : entryLocked,
  scoreEntries: bracketScoreEntries,
  // Label-free: rank on total alone; the caller breaks display ties by label.
  compareForRank: (a, b) => b.total - a.total,
};
