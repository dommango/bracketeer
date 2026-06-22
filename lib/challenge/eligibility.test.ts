import { describe, it, expect } from "vitest";
import { CHALLENGE_ENTRY_CAP, isKnockoutEntryComplete, isMd3EntryComplete } from "./eligibility";
import { scoredKnockoutNumbers } from "@/lib/pool/pick-form";
import { MD3_MATCH_NOS, type ScoreLine } from "@/lib/pool/match-day-3";
import { emptyPicks, type Picks } from "@/lib/scoring/types";

function completeKnockoutPicks(): Picks {
  const picks = emptyPicks();
  // Fill every scored knockout winner with an arbitrary placeholder team code —
  // completeness only counts that each slot is chosen, not that it's consistent
  // with a seed (that's a separate check at submit time).
  for (const no of scoredKnockoutNumbers()) picks.knockout[no] = "BRA";
  return picks;
}

function completeMd3Scores(): Record<number, ScoreLine> {
  const scores: Record<number, ScoreLine> = {};
  for (const no of MD3_MATCH_NOS) scores[no] = { home: 1, away: 0 };
  return scores;
}

describe("isKnockoutEntryComplete", () => {
  it("is true for a fully-filled knockout bracket", () => {
    expect(isKnockoutEntryComplete(completeKnockoutPicks())).toBe(true);
  });
  it("is false when any scored winner is missing", () => {
    const picks = completeKnockoutPicks();
    delete picks.knockout[104]; // drop the Final pick
    expect(isKnockoutEntryComplete(picks)).toBe(false);
  });
  it("is false for an empty bracket", () => {
    expect(isKnockoutEntryComplete(emptyPicks())).toBe(false);
  });
});

describe("isMd3EntryComplete", () => {
  it("is true when all 24 fixtures are predicted", () => {
    expect(isMd3EntryComplete(completeMd3Scores())).toBe(true);
  });
  it("is false when any fixture is missing", () => {
    const scores = completeMd3Scores();
    delete scores[MD3_MATCH_NOS[0]];
    expect(isMd3EntryComplete(scores)).toBe(false);
  });
  it("is false for no predictions", () => {
    expect(isMd3EntryComplete({})).toBe(false);
  });
});

describe("entry cap", () => {
  it("is 2 per person per challenge", () => {
    expect(CHALLENGE_ENTRY_CAP).toBe(2);
  });
});
