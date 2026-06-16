import { describe, it, expect } from "vitest";
import { TEAMS } from "@/lib/scoring/data";
import { TEAM_TO_ISO2 } from "@/app/pool/[code]/Flag";
import {
  TEAM_COLORS,
  NEUTRAL,
  colorDistance,
  teamColor,
  resolvePair,
} from "./colors";

describe("teamColor", () => {
  it("returns a team's primary color", () => {
    expect(teamColor("BRA")).toBe(TEAM_COLORS.BRA.primary);
  });

  it("falls back to NEUTRAL for null/unknown codes", () => {
    expect(teamColor(null)).toBe(NEUTRAL);
    expect(teamColor(undefined)).toBe(NEUTRAL);
    expect(teamColor("ZZZ")).toBe(NEUTRAL);
  });
});

describe("colorDistance", () => {
  it("is zero for identical colors and positive otherwise", () => {
    expect(colorDistance("#ffffff", "#ffffff")).toBe(0);
    expect(colorDistance("#000000", "#ffffff")).toBeGreaterThan(0);
  });
});

describe("resolvePair", () => {
  it("keeps both primaries when they are visually distinct", () => {
    const { home, away } = resolvePair("BRA", "ARG"); // yellow vs sky blue
    expect(home).toBe(TEAM_COLORS.BRA.primary);
    expect(away).toBe(TEAM_COLORS.ARG.primary);
  });

  it("falls the away side back to its secondary when primaries clash", () => {
    // TUR (#e30a17) and AUT (#ed2939) are both reds — near-identical primaries.
    const { home, away } = resolvePair("TUR", "AUT");
    expect(home).toBe(TEAM_COLORS.TUR.primary);
    expect(away).toBe(TEAM_COLORS.AUT.secondary);
    expect(away).not.toBe(TEAM_COLORS.AUT.primary);
  });

  it("falls back to NEUTRAL when both away colors clash with home", () => {
    // Two unknown codes both resolve to NEUTRAL, so neither away color is distinct.
    const { home, away } = resolvePair("ZZZ", "YYY");
    expect(home).toBe(NEUTRAL);
    expect(away).toBe(NEUTRAL);
  });

  it("handles a null away code", () => {
    const { home, away } = resolvePair("BRA", null);
    expect(home).toBe(TEAM_COLORS.BRA.primary);
    expect(away).toBe(NEUTRAL);
  });
});

describe("team-code map coverage", () => {
  it("has a color entry for every team in TEAMS", () => {
    for (const code of Object.keys(TEAMS)) {
      expect(TEAM_COLORS[code], `missing color for ${code}`).toBeDefined();
    }
  });

  // Guards against drift between TEAMS, TEAM_COLORS, and Flag's TEAM_TO_ISO2 —
  // a code present in one but missing from another renders a colorless/flagless row.
  it("has a flag entry for every team in TEAMS", () => {
    for (const code of Object.keys(TEAMS)) {
      expect(TEAM_TO_ISO2[code], `missing flag for ${code}`).toBeDefined();
    }
  });
});
