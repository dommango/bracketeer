import { describe, it, expect } from "vitest";
import { parseGoalscorerOutrights } from "./parse";
import { toGoalscorerProbs } from "./map";
import type { ApiEvent } from "./parse";

const event = (outcomes: Array<{ name: string; price: number }>): ApiEvent => ({
  home_team: "",
  away_team: "",
  commence_time: "2026-06-20T00:00:00Z",
  bookmakers: [{ markets: [{ key: "outrights", outcomes }] }],
});

describe("parseGoalscorerOutrights", () => {
  it("reads player name + price from the first event's outrights market", () => {
    const raw = [event([
      { name: "Kylian Mbappé", price: 6.5 },
      { name: "Erling Haaland", price: 8 },
    ])];
    expect(parseGoalscorerOutrights(raw)).toEqual([
      { playerName: "Kylian Mbappé", decimal: 6.5 },
      { playerName: "Erling Haaland", decimal: 8 },
    ]);
  });

  it("returns [] when there is no outrights market", () => {
    const raw: ApiEvent[] = [{ ...event([]), bookmakers: [{ markets: [{ key: "h2h", outcomes: [] }] }] }];
    expect(parseGoalscorerOutrights(raw)).toEqual([]);
    expect(parseGoalscorerOutrights([])).toEqual([]);
  });

  it("skips outcomes with no name or no price", () => {
    const raw = [event([{ name: "", price: 5 }])];
    expect(parseGoalscorerOutrights(raw)).toEqual([]);
  });
});

describe("toGoalscorerProbs", () => {
  it("inverts and normalizes prices across the field to sum to 1", () => {
    const probs = toGoalscorerProbs([
      { playerName: "A", decimal: 2 }, // 1/2 = 0.5
      { playerName: "B", decimal: 4 }, // 1/4 = 0.25
      { playerName: "C", decimal: 4 }, // 1/4 = 0.25
    ]);
    expect(probs.map((p) => p.playerName)).toEqual(["A", "B", "C"]);
    const total = probs.reduce((s, p) => s + p.winProb, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(probs[0].winProb).toBeCloseTo(0.5, 10); // 0.5 / 1.0
  });

  it("drops bad prices and empty names, returns [] when nothing usable", () => {
    expect(toGoalscorerProbs([{ playerName: "A", decimal: 0 }, { playerName: "", decimal: 3 }])).toEqual([]);
  });
});
