import { describe, it, expect } from "vitest";
import { parseTotalsEvents, parseOutrights } from "./parse";

// The Odds API event shape, trimmed to the fields the parsers read.
function totalsEvent(point: number | undefined, over: number, under: number) {
  return {
    home_team: "Brazil",
    away_team: "Mexico",
    commence_time: "2026-06-13T19:00:00Z",
    bookmakers: [
      {
        markets: [
          {
            key: "totals",
            outcomes: [
              { name: "Over", price: over, point },
              { name: "Under", price: under, point },
            ],
          },
        ],
      },
    ],
  };
}

describe("parseTotalsEvents", () => {
  it("extracts the line and both prices", () => {
    const out = parseTotalsEvents([totalsEvent(2.5, 1.8, 2.0)] as never);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      homeName: "Brazil",
      awayName: "Mexico",
      totalLine: 2.5,
      decimalOver: 1.8,
      decimalUnder: 2.0,
    });
  });

  it("skips events with no totals market", () => {
    const ev = {
      home_team: "A",
      away_team: "B",
      commence_time: "2026-06-13T19:00:00Z",
      bookmakers: [{ markets: [{ key: "h2h", outcomes: [] }] }],
    };
    expect(parseTotalsEvents([ev] as never)).toEqual([]);
  });

  it("skips events missing the goals line", () => {
    expect(parseTotalsEvents([totalsEvent(undefined, 1.8, 2.0)] as never)).toEqual([]);
  });

  it("rejects asymmetric Over/Under lines", () => {
    const ev = {
      home_team: "A",
      away_team: "B",
      commence_time: "2026-06-13T19:00:00Z",
      bookmakers: [
        {
          markets: [
            {
              key: "totals",
              outcomes: [
                { name: "Over", price: 1.8, point: 2.5 },
                { name: "Under", price: 2.0, point: 3.5 },
              ],
            },
          ],
        },
      ],
    };
    expect(parseTotalsEvents([ev] as never)).toEqual([]);
  });
});

describe("parseOutrights", () => {
  it("reads every team's outright price from the first event", () => {
    const raw = [
      {
        home_team: "",
        away_team: "",
        commence_time: "2026-07-19T19:00:00Z",
        bookmakers: [
          {
            markets: [
              {
                key: "outrights",
                outcomes: [
                  { name: "Brazil", price: 5 },
                  { name: "France", price: 6 },
                  { name: "Mexico", price: 21 },
                ],
              },
            ],
          },
        ],
      },
    ];
    const out = parseOutrights(raw as never);
    expect(out).toEqual([
      { teamName: "Brazil", decimal: 5 },
      { teamName: "France", decimal: 6 },
      { teamName: "Mexico", decimal: 21 },
    ]);
  });

  it("returns empty when there is no outrights market", () => {
    expect(parseOutrights([] as never)).toEqual([]);
  });
});
