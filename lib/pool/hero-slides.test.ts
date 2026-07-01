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

  it("leads with the knockout bracket while its picks are open", () => {
    // Just after knockout-bracket picks open (before the R32 kickoff): the bracket
    // is recruiting (featured) and the knockout pick'em is still open — both slides
    // show, bracket first.
    const now = new Date(new Date(KNOCKOUT_PICKS_OPEN_UTC).getTime() + 1000);
    const slides = availableHeroSlides(now);
    expect(slides.map((s) => s.format)).toEqual(["KNOCKOUT", "MATCH_DAY_3_PICKEM"]);
  });

  it("leads with the Match Day Pickem once the bracket locks at the R32 kickoff", () => {
    // After the Round of 32 kickoff: the bracket is locked/live, but the knockout
    // pick'em plays on through the rounds — so it takes the lead slide, and the
    // locked bracket still shows its live state.
    const r32 = kickoffFor(73);
    expect(r32).not.toBeNull();
    const now = new Date(r32!.getTime() + 1000);
    const slides = availableHeroSlides(now);
    expect(slides.map((s) => s.format)).toEqual(["MATCH_DAY_3_PICKEM", "KNOCKOUT"]);
    const ko = slides.find((s) => s.format === "KNOCKOUT")!;
    expect(ko.stateLine.toLowerCase()).toContain("live");
  });
});
