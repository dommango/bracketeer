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

  it("leads with knockout (recruiting) while MD3 plays out live", () => {
    // Just after knockout picks open — MD3's last kickoff (June 27) is past, so MD3
    // is live and knockout is recruiting: both slides show, knockout (featured) first.
    const now = new Date(new Date(KNOCKOUT_PICKS_OPEN_UTC).getTime() + 1000);
    const slides = availableHeroSlides(now);
    expect(slides.map((s) => s.format)).toEqual(["KNOCKOUT", "MATCH_DAY_3_PICKEM"]);
  });

  it("drops MD3 once complete: only the knockout slide survives the R32 kickoff", () => {
    // After the Round of 32 kickoff (knockout lock) MD3 finished the night
    // before — advertising it as "Live now" was the bug. Only the genuinely
    // live game keeps a slide.
    const r32 = kickoffFor(73);
    expect(r32).not.toBeNull();
    const now = new Date(r32!.getTime() + 1000);
    const slides = availableHeroSlides(now);
    expect(slides.map((s) => s.format)).toEqual(["KNOCKOUT"]);
    expect(slides[0].stateLine.toLowerCase()).toContain("live");
  });
});
