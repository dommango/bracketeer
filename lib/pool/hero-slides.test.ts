import { describe, it, expect } from "vitest";
import { availableHeroSlides } from "./hero-slides";
import { firstMd3Kickoff } from "@/lib/pool/match-day-3";
import { KNOCKOUT_PICKS_OPEN_UTC } from "@/lib/pool/knockout";
import { kickoffFor } from "@/lib/scoring/schedule";

describe("availableHeroSlides", () => {
  it("shows both games (featured first) while MD3 picks are open and knockout is creatable", () => {
    // Just before the first MD3 kickoff: MD3 PICKS_OPEN, knockout still CREATE_ONLY.
    const now = new Date(firstMd3Kickoff().getTime() - 1000);
    const slides = availableHeroSlides(now);
    expect(slides.map((s) => s.format)).toEqual(["MATCH_DAY_3_PICKEM", "KNOCKOUT"]);
  });

  it("shows only knockout once MD3 has locked and knockout picks are open", () => {
    // Just after knockout picks open — MD3's last kickoff (June 27) is already past.
    const now = new Date(new Date(KNOCKOUT_PICKS_OPEN_UTC).getTime() + 1000);
    const slides = availableHeroSlides(now);
    expect(slides.map((s) => s.format)).toEqual(["KNOCKOUT"]);
  });

  it("shows nothing once both games are locked", () => {
    // After the Round of 32 kickoff (knockout lock) — both games are live/locked.
    const r32 = kickoffFor(73);
    expect(r32).not.toBeNull();
    const now = new Date(r32!.getTime() + 1000);
    expect(availableHeroSlides(now)).toEqual([]);
  });
});
