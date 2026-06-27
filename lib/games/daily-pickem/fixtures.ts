// The daily knockout fixtures, resolved from the official results — the analog of
// md3Fixtures() for the knockout rounds. Competitors come from the answer key, not
// each picker's guesses: R32 from the resolved seed (knockoutR32Seed), later rounds
// from the official winners of their feeder matches (Results.knockout[feederId]).
// A match whose two competitors aren't both known yet is returned with null codes
// and open=false — exactly when it can't be picked. Pure + client-safe (no prisma).

import { R32, R16, QF, SF, FINAL, type KnockoutMatch } from "@/lib/scoring/data";
import { kickoffFor } from "@/lib/scoring/schedule";
import { knockoutR32Seed } from "@/lib/pool/knockout";
import { stageOf, type Stage } from "@/lib/games/stage";
import type { Results, TeamCode } from "@/lib/scoring/types";

export interface DailyKnockoutFixture {
  matchNo: number;
  stage: Stage; // R32 | R16 | QF | SF | FINAL
  homeCode: TeamCode | null;
  awayCode: TeamCode | null;
  kickoff: Date | null;
  // True once BOTH competitors are seated — i.e. the match can be picked. Mirrors
  // hasConcreteR32Slots per match for R32, and "both feeder winners decided" after.
  open: boolean;
}

const DOWNSTREAM: KnockoutMatch[] = [...R16, ...QF, ...SF, FINAL];

export function knockoutDailyFixtures(results: Results): DailyKnockoutFixture[] {
  const seed = knockoutR32Seed(results);
  const winnerOf = (matchId: number): TeamCode | null => results.knockout?.[matchId] ?? null;

  const build = (matchNo: number, home: TeamCode | null, away: TeamCode | null): DailyKnockoutFixture => ({
    matchNo,
    stage: (stageOf(matchNo) ?? "R32") as Stage,
    homeCode: home,
    awayCode: away,
    kickoff: kickoffFor(matchNo),
    open: Boolean(home && away),
  });

  const out: DailyKnockoutFixture[] = [];
  for (const m of R32) out.push(build(m.id, seed[m.id]?.a ?? null, seed[m.id]?.b ?? null));
  for (const m of DOWNSTREAM) out.push(build(m.id, winnerOf(m.a), winnerOf(m.b)));

  return out.sort(
    (a, b) => (a.kickoff?.getTime() ?? 0) - (b.kickoff?.getTime() ?? 0) || a.matchNo - b.matchNo,
  );
}

// Just the fixtures that can be picked right now (both teams seated).
export function openKnockoutDailyFixtures(results: Results): DailyKnockoutFixture[] {
  return knockoutDailyFixtures(results).filter((f) => f.open);
}
