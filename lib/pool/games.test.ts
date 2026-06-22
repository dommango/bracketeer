import { describe, it, expect } from "vitest";
import { GAME_CATALOG, resolveGamePhase, featuredGame, prizeTeaser } from "./games";
import type { PoolFormat } from "@/lib/pool/manage";

// Fixed schedule anchors mirrored from lib/scoring/schedule + lib/pool/knockout.
const MD3_FIRST = "2026-06-24T19:00:00Z";
// The latest round-3 kickoff is match 57/58 (Group J) at 02:00 Jun 28 — which
// coincides exactly with the knockout open instant, so MD3 hands straight off to
// the Knockout Challenge with no gap between them.
const MD3_LAST = "2026-06-28T02:00:00Z";
const KO_OPEN = "2026-06-28T02:00:00Z";
const KO_LOCK = "2026-06-28T19:00:00Z";
const FULL_START = "2026-06-11T19:00:00Z";

const at = (iso: string) => new Date(iso);

describe("GAME_CATALOG", () => {
  it("has an entry per format", () => {
    const formats: PoolFormat[] = ["FULL_BRACKET", "KNOCKOUT", "MATCH_DAY_3_PICKEM"];
    for (const f of formats) {
      expect(GAME_CATALOG[f]).toBeTruthy();
      expect(GAME_CATALOG[f].name.length).toBeGreaterThan(0);
      expect(GAME_CATALOG[f].blurb.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveGamePhase — MD3", () => {
  it("is PICKS_OPEN before the first lock", () => {
    const s = resolveGamePhase("MATCH_DAY_3_PICKEM", at("2026-06-22T00:00:00Z"));
    expect(s.phase).toBe("PICKS_OPEN");
    expect(s.creatable).toBe(true);
    expect(s.joinable).toBe(true);
  });
  it("flips to PICKS_CLOSING exactly at the first lock", () => {
    expect(resolveGamePhase("MATCH_DAY_3_PICKEM", at(MD3_FIRST)).phase).toBe("PICKS_CLOSING");
  });
  it("is still joinable while closing", () => {
    const s = resolveGamePhase("MATCH_DAY_3_PICKEM", at("2026-06-26T00:00:00Z"));
    expect(s.phase).toBe("PICKS_CLOSING");
    expect(s.joinable).toBe(true);
  });
  it("is LOCKED_LIVE at and after the last lock", () => {
    const s = resolveGamePhase("MATCH_DAY_3_PICKEM", at(MD3_LAST));
    expect(s.phase).toBe("LOCKED_LIVE");
    expect(s.joinable).toBe(false);
    expect(s.creatable).toBe(false);
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
});

describe("resolveGamePhase — FULL_BRACKET", () => {
  it("is creatable (UPCOMING) before kickoff and locked after", () => {
    expect(resolveGamePhase("FULL_BRACKET", at("2026-06-10T00:00:00Z")).creatable).toBe(true);
    expect(resolveGamePhase("FULL_BRACKET", at(FULL_START)).phase).toBe("LOCKED_LIVE");
    expect(resolveGamePhase("FULL_BRACKET", at("2026-06-22T00:00:00Z")).creatable).toBe(false);
  });
});

describe("featuredGame across the Jun 22→28 window", () => {
  it("spotlights MD3 today (Jun 22)", () => {
    expect(featuredGame(at("2026-06-22T12:00:00Z"))).toBe("MATCH_DAY_3_PICKEM");
  });
  it("still spotlights MD3 while closing (Jun 26)", () => {
    expect(featuredGame(at("2026-06-26T12:00:00Z"))).toBe("MATCH_DAY_3_PICKEM");
  });
  it("still spotlights MD3 right up to the last kickoff (Jun 28 01:00)", () => {
    expect(featuredGame(at("2026-06-27T22:00:00Z"))).toBe("MATCH_DAY_3_PICKEM");
    expect(featuredGame(at("2026-06-28T01:00:00Z"))).toBe("MATCH_DAY_3_PICKEM");
  });
  it("hands off to Knockout exactly when MD3 closes / KO opens (Jun 28 02:00)", () => {
    expect(featuredGame(at("2026-06-28T02:00:00Z"))).toBe("KNOCKOUT");
    expect(featuredGame(at("2026-06-28T03:00:00Z"))).toBe("KNOCKOUT");
  });
  it("spotlights nothing once knockout locks", () => {
    expect(featuredGame(at(KO_LOCK))).toBeNull();
  });
});

describe("prizeTeaser", () => {
  it("returns a teaser for challenge formats and null for full bracket", () => {
    expect(prizeTeaser("KNOCKOUT")).toMatch(/gift card/i);
    expect(prizeTeaser("MATCH_DAY_3_PICKEM")).toMatch(/gift card/i);
    expect(prizeTeaser("FULL_BRACKET")).toBeNull();
  });
});
