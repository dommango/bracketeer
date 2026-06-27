// The game registry: gameFor(format) returns the one GameModule for a pool format.
// This is the single dispatch point the orchestrator (lib/pool/scoring.ts) uses in
// place of the former hard-coded `=== "MATCH_DAY_3_PICKEM"` forks.

import type { PoolFormat } from "@/lib/pool/manage";
import type { GameModule } from "./types";
import { fullBracketModule } from "./full-bracket";
import { knockoutModule } from "./knockout";
import { md3Module } from "./md3";

const REGISTRY: Record<PoolFormat, GameModule> = {
  FULL_BRACKET: fullBracketModule,
  KNOCKOUT: knockoutModule,
  MATCH_DAY_3_PICKEM: md3Module,
};

export function gameFor(format: PoolFormat): GameModule {
  return REGISTRY[format];
}
