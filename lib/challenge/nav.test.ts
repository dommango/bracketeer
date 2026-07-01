import { describe, it, expect } from "vitest";
import { challengeBaseFromPath, switchGameHref, unifiedPicksBase } from "./nav";
import { firstMd3Kickoff } from "@/lib/pool/match-day-3";
import { KNOCKOUT_PICKS_OPEN_UTC } from "@/lib/pool/knockout";

describe("challengeBaseFromPath", () => {
  it("extracts the game base from a game tree path", () => {
    expect(challengeBaseFromPath("/challenge/md3")).toBe("/challenge/md3");
    expect(challengeBaseFromPath("/challenge/md3/play")).toBe("/challenge/md3");
    expect(challengeBaseFromPath("/challenge/knockout/leaderboard")).toBe("/challenge/knockout");
  });

  it("returns null off a game tree", () => {
    expect(challengeBaseFromPath("/challenge")).toBeNull();
    expect(challengeBaseFromPath("/challenge/picks")).toBeNull();
    expect(challengeBaseFromPath("/")).toBeNull();
  });
});

describe("switchGameHref", () => {
  it("preserves a shared tab family across the switch", () => {
    expect(switchGameHref("/challenge/md3/leaderboard", "knockout")).toBe(
      "/challenge/knockout/leaderboard",
    );
    expect(switchGameHref("/challenge/knockout/matches", "md3")).toBe("/challenge/md3/matches");
    expect(switchGameHref("/challenge/md3", "knockout")).toBe("/challenge/knockout");
  });

  it("falls back to the target home for game-specific subpaths", () => {
    expect(switchGameHref("/challenge/md3/play", "knockout")).toBe("/challenge/knockout");
    expect(switchGameHref("/challenge/md3/u/abc123", "knockout")).toBe("/challenge/knockout");
    expect(switchGameHref("/challenge/knockout/matches/89", "md3")).toBe("/challenge/md3");
  });

  it("returns the target home when not on a game tree", () => {
    expect(switchGameHref("/challenge/picks", "md3")).toBe("/challenge/md3");
    expect(switchGameHref("/challenge/picks", "knockout")).toBe("/challenge/knockout");
  });
});

describe("unifiedPicksBase", () => {
  it("resolves to md3 while the Match Day Pickem is the featured game", () => {
    // Before the knockout bracket opens, the knockout pick'em is joinable and no
    // bracket picks are open yet → the pick'em is featured.
    const beforeBracketOpens = new Date(firstMd3Kickoff().getTime() - 1000);
    expect(unifiedPicksBase(beforeBracketOpens)).toBe("/challenge/md3");
  });

  it("resolves to knockout while the bracket's picks are open", () => {
    // Once the knockout-bracket picks open (before the R32 kickoff), the bracket is
    // featured — it locks entirely at kickoff — so the unified picks default points
    // at the knockout challenge.
    const bracketOpen = new Date(new Date(KNOCKOUT_PICKS_OPEN_UTC).getTime() + 1000);
    expect(unifiedPicksBase(bracketOpen)).toBe("/challenge/knockout");
  });
});
