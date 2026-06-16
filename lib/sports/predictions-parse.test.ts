import { describe, it, expect } from "vitest";
import { parsePrediction, type ApiPredictionResponse } from "./predictions-parse";

describe("parsePrediction", () => {
  it("parses percents, advice and form", () => {
    const resp: ApiPredictionResponse = {
      predictions: {
        advice: "Double chance : Brazil or draw",
        percent: { home: "55%", draw: "30%", away: "15%" },
      },
      teams: {
        home: { id: 6, last_5: { form: "WWDLW" } },
        away: { id: 16, last_5: { form: "LDLWD" } },
      },
      h2h: [],
    };
    const out = parsePrediction(resp);
    expect(out.homePercent).toBe(55);
    expect(out.drawPercent).toBe(30);
    expect(out.awayPercent).toBe(15);
    expect(out.advice).toBe("Double chance : Brazil or draw");
    expect(out.homeForm).toBe("WWDLW");
    expect(out.awayForm).toBe("LDLWD");
    expect(out.h2h).toBeNull(); // empty list
  });

  it("summarizes h2h relative to the current home/away ids", () => {
    const resp: ApiPredictionResponse = {
      teams: { home: { id: 6 }, away: { id: 16 } },
      h2h: [
        { teams: { home: { id: 6 }, away: { id: 16 } }, goals: { home: 2, away: 1 } }, // home (6) win
        { teams: { home: { id: 16 }, away: { id: 6 } }, goals: { home: 0, away: 0 } }, // draw
        { teams: { home: { id: 16 }, away: { id: 6 } }, goals: { home: 3, away: 1 } }, // 16 win → away
        { teams: { home: { id: 6 }, away: { id: 16 } }, goals: { home: null, away: null } }, // unplayed → skipped
      ],
    };
    const out = parsePrediction(resp);
    expect(out.h2h).toEqual({ played: 3, homeWins: 1, awayWins: 1, draws: 1 });
  });

  it("keeps played consistent when a result maps to neither current team", () => {
    const resp: ApiPredictionResponse = {
      teams: { home: { id: 6 }, away: { id: 16 } },
      h2h: [
        { teams: { home: { id: 6 }, away: { id: 16 } }, goals: { home: 2, away: 1 } }, // home win
        { teams: { home: { id: 99 }, away: { id: 6 } }, goals: { home: 3, away: 0 } }, // winner 99 → neither → ignored
      ],
    };
    const out = parsePrediction(resp);
    // played (1) must equal homeWins + awayWins + draws (1+0+0); the stray result is dropped.
    expect(out.h2h).toEqual({ played: 1, homeWins: 1, awayWins: 0, draws: 0 });
  });

  it("clamps out-of-range percents", () => {
    const out = parsePrediction({ predictions: { percent: { home: "150%", draw: "-5%", away: "20%" } } });
    expect(out.homePercent).toBe(100);
    expect(out.drawPercent).toBe(0);
    expect(out.awayPercent).toBe(20);
  });

  it("tolerates missing fields", () => {
    const out = parsePrediction({});
    expect(out).toEqual({
      homePercent: null,
      drawPercent: null,
      awayPercent: null,
      advice: null,
      homeForm: null,
      awayForm: null,
      h2h: null,
    });
  });
});
