// The full chromatic round sweep — group-stage green through the knockout host-city
// tints to gold — keyed by round code. Shared by the match cards (ScoreCards,
// MatchCenter) so their accents can't drift. The knockout-only subset (no GROUP)
// lives in bracket-tree.ts alongside the bracket layout helpers.

export const ROUND_ACCENT: Record<string, string> = {
  GROUP: "var(--pitch)",
  R32: "var(--round-r32)",
  R16: "var(--round-r16)",
  QF: "var(--round-qf)",
  SF: "var(--round-sf)",
  BRONZE: "var(--gold-dark)",
  FINAL: "var(--round-final)",
};
