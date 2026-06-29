import { describe, it, expect } from "vitest";
import { challengeBaseFromPath, switchGameHref, unifiedPicksBase } from "./nav";
import { firstMd3Kickoff, lastMd3Kickoff } from "@/lib/pool/match-day-3";

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
  it("resolves to md3 while Match Day Pickem is the featured game", () => {
    // Just before the first MD3 kickoff, MD3 is still joinable → featured.
    const duringMd3 = new Date(firstMd3Kickoff().getTime() - 1000);
    expect(unifiedPicksBase(duringMd3)).toBe("/challenge/md3");
  });

  it("resolves to knockout once MD3 is no longer the featured game", () => {
    // After the last MD3 kickoff MD3 is no longer joinable, so the knockout
    // challenge becomes the default board — whether its picks are open or already
    // live (the later stage stays the default once MD3 closes).
    const afterMd3 = new Date(lastMd3Kickoff().getTime() + 1000);
    expect(unifiedPicksBase(afterMd3)).toBe("/challenge/knockout");
  });
});
