import { describe, it, expect } from "vitest";
import {
  GAME_CATALOG,
  resolveGamePhase,
  featuredGame,
  prizeTeaser,
  md3DateRange,
  koPickemDateRange,
} from "./games";
import type { PoolFormat } from "@/lib/pool/manage";

// Fixed schedule anchors mirrored from lib/scoring/schedule + lib/pool/knockout.
// Match Day Pickem is now the knockout daily pick'em: it opens until the Round of
// 32 kicks off, plays out ("closing") through the knockout rounds, and locks once
// the Final kicks off.
const KO_PICKEM_FIRST = "2026-06-28T19:00:00Z"; // R32 kickoff (match 73)
const KO_PICKEM_LAST = "2026-07-19T19:00:00Z"; // Final kickoff (match 104)
const KO_OPEN = "2026-06-28T02:00:00Z"; // Knockout-bracket picks open
const KO_LOCK = "2026-06-28T19:00:00Z"; // Knockout-bracket lock == R32 kickoff
const FULL_START = "2026-06-11T19:00:00Z";

const at = (iso: string) => new Date(iso);

describe("GAME_CATALOG", () => {
  it("has an entry per format with a context name + blurb", () => {
    const formats: PoolFormat[] = ["FULL_BRACKET", "KNOCKOUT", "MATCH_DAY_3_PICKEM"];
    for (const f of formats) {
      expect(GAME_CATALOG[f]).toBeTruthy();
      // Every format names itself as a pool, a challenge, or both.
      const name = GAME_CATALOG[f].poolName ?? GAME_CATALOG[f].challengeName ?? "";
      expect(name.length).toBeGreaterThan(0);
      expect(GAME_CATALOG[f].blurb.length).toBeGreaterThan(0);
    }
  });

  it("names each format by context (pool vs challenge)", () => {
    // Full tournament: pool only.
    expect(GAME_CATALOG.FULL_BRACKET.poolName).toBe("Full Tournament Pool");
    expect(GAME_CATALOG.FULL_BRACKET.challengeName).toBeUndefined();
    // Knockout: a pool privately, a challenge publicly.
    expect(GAME_CATALOG.KNOCKOUT.poolName).toBe("Knockout Stage Pool");
    expect(GAME_CATALOG.KNOCKOUT.challengeName).toBe("Knockout Challenge");
    // Match Day Pickem: challenge only.
    expect(GAME_CATALOG.MATCH_DAY_3_PICKEM.challengeName).toBe("Match Day Pickem");
    expect(GAME_CATALOG.MATCH_DAY_3_PICKEM.poolName).toBeUndefined();
  });
});

describe("resolveGamePhase — MD3 (knockout pick'em)", () => {
  it("is PICKS_OPEN before the Round of 32 kicks off", () => {
    const s = resolveGamePhase("MATCH_DAY_3_PICKEM", at("2026-06-22T00:00:00Z"));
    expect(s.phase).toBe("PICKS_OPEN");
    expect(s.creatable).toBe(true);
    expect(s.joinable).toBe(true);
  });
  it("flips to PICKS_CLOSING exactly at the Round-of-32 kickoff", () => {
    expect(resolveGamePhase("MATCH_DAY_3_PICKEM", at(KO_PICKEM_FIRST)).phase).toBe("PICKS_CLOSING");
  });
  it("is still joinable while the knockout rounds play out", () => {
    const s = resolveGamePhase("MATCH_DAY_3_PICKEM", at("2026-07-05T00:00:00Z"));
    expect(s.phase).toBe("PICKS_CLOSING");
    expect(s.joinable).toBe(true);
  });
  it("is LOCKED_LIVE at and after the Final kickoff", () => {
    const s = resolveGamePhase("MATCH_DAY_3_PICKEM", at(KO_PICKEM_LAST));
    expect(s.phase).toBe("LOCKED_LIVE");
    expect(s.joinable).toBe(false);
    expect(s.creatable).toBe(false);
  });
  it("is COMPLETE once the Final has settled (never 'live' forever)", () => {
    // Final kickoff (19:00 Jul 19) + the 6h settle window → complete from 01:00 Jul 20.
    expect(resolveGamePhase("MATCH_DAY_3_PICKEM", at("2026-07-20T00:59:00Z")).phase).toBe(
      "LOCKED_LIVE",
    );
    expect(resolveGamePhase("MATCH_DAY_3_PICKEM", at("2026-07-20T01:00:00Z")).phase).toBe(
      "COMPLETE",
    );
  });
});

describe("resolveGamePhase — KNOCKOUT", () => {
  it("is CREATE_ONLY before picks open (invite now, pick later)", () => {
    const s = resolveGamePhase("KNOCKOUT", at("2026-06-22T00:00:00Z"));
    expect(s.phase).toBe("CREATE_ONLY");
    expect(s.creatable).toBe(true);
  });
  it("flips to PICKS_OPEN exactly at the open instant", () => {
    expect(resolveGamePhase("KNOCKOUT", at(KO_OPEN)).phase).toBe("PICKS_OPEN");
  });
  it("is LOCKED_LIVE at and after the R32 kickoff", () => {
    expect(resolveGamePhase("KNOCKOUT", at(KO_LOCK)).phase).toBe("LOCKED_LIVE");
  });
  it("stays LOCKED_LIVE through the knockout rounds, COMPLETE after the final settles", () => {
    expect(resolveGamePhase("KNOCKOUT", at("2026-07-02T12:00:00Z")).phase).toBe("LOCKED_LIVE");
    expect(resolveGamePhase("KNOCKOUT", at("2026-07-21T00:00:00Z")).phase).toBe("COMPLETE");
  });
});

describe("resolveGamePhase — FULL_BRACKET", () => {
  it("is creatable (UPCOMING) before kickoff and locked after", () => {
    expect(resolveGamePhase("FULL_BRACKET", at("2026-06-10T00:00:00Z")).creatable).toBe(true);
    expect(resolveGamePhase("FULL_BRACKET", at(FULL_START)).phase).toBe("LOCKED_LIVE");
    expect(resolveGamePhase("FULL_BRACKET", at("2026-06-22T00:00:00Z")).creatable).toBe(false);
  });
  it("is COMPLETE after the final settles", () => {
    expect(resolveGamePhase("FULL_BRACKET", at("2026-07-21T00:00:00Z")).phase).toBe("COMPLETE");
  });
});

describe("date ranges", () => {
  it("frames spans in the display timezone (Eastern), not UTC", () => {
    // The last group MD3 kickoff is 02:00Z Jun 28 = 10:00 PM ET Jun 27 — the UTC
    // framing this replaced printed "June 24–28" for the June 24–27 slate.
    expect(md3DateRange()).toBe("June 24–27");
    // Knockout pick'em span: R32 kickoff → Final kickoff, both mid-day ET.
    expect(koPickemDateRange()).toBe("June 28 – July 19");
  });
});

describe("featuredGame across the knockout window", () => {
  it("spotlights the Match Day Pickem before the knockout bracket opens (Jun 22)", () => {
    expect(featuredGame(at("2026-06-22T12:00:00Z"))).toBe("MATCH_DAY_3_PICKEM");
  });
  it("hands the spotlight to the Knockout bracket while its picks are open (Jun 28 02:00–19:00)", () => {
    expect(featuredGame(at("2026-06-28T02:00:00Z"))).toBe("KNOCKOUT");
    expect(featuredGame(at("2026-06-28T12:00:00Z"))).toBe("KNOCKOUT");
  });
  it("returns to the Match Day Pickem once the bracket locks at the R32 kickoff", () => {
    // R32 kickoff: the bracket is LOCKED_LIVE, the pick'em plays on through the rounds.
    expect(featuredGame(at(KO_LOCK))).toBe("MATCH_DAY_3_PICKEM");
    expect(featuredGame(at("2026-07-05T12:00:00Z"))).toBe("MATCH_DAY_3_PICKEM");
  });
  it("spotlights nothing once the Final kicks off (both games locked)", () => {
    expect(featuredGame(at(KO_PICKEM_LAST))).toBeNull();
  });
});

describe("prizeTeaser", () => {
  it("returns a teaser for the knockout bracket, null for the free pick'em and full bracket", () => {
    // Knockout is a scaled prize (advertises the guaranteed floor "$50+"); the Match
    // Day Pickem is now the free knockout game (no prize); full bracket has none.
    expect(prizeTeaser("KNOCKOUT")).toMatch(/top the challenge.*\$50\+ gift card/i);
    expect(prizeTeaser("MATCH_DAY_3_PICKEM")).toBeNull();
    expect(prizeTeaser("FULL_BRACKET")).toBeNull();
  });
});
