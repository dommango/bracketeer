import { describe, it, expect } from "vitest";
import { parseOddsEvents, parseTotalsEvents, parseOutrights } from "./parse";

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

describe("parseOddsEvents", () => {
  const h2hBook = (h: number, d: number, a: number) => ({
    markets: [
      {
        key: "h2h",
        outcomes: [
          { name: "Brazil", price: h },
          { name: "Draw", price: d },
          { name: "Mexico", price: a },
        ],
      },
    ],
  });

  it("takes the median price across all bookmakers, not just the first", () => {
    const ev = {
      home_team: "Brazil",
      away_team: "Mexico",
      commence_time: "2026-06-13T19:00:00Z",
      bookmakers: [h2hBook(1.5, 4.0, 7.0), h2hBook(1.7, 4.2, 6.0), h2hBook(1.6, 4.1, 6.5)],
    };
    expect(parseOddsEvents([ev] as never)[0]).toMatchObject({
      decimalHome: 1.6, // median of 1.5, 1.6, 1.7
      decimalDraw: 4.1,
      decimalAway: 6.5,
    });
  });

  it("skips bookmakers missing an outcome but still uses the rest", () => {
    const partial = { markets: [{ key: "h2h", outcomes: [{ name: "Brazil", price: 2.0 }] }] };
    const ev = {
      home_team: "Brazil",
      away_team: "Mexico",
      commence_time: "2026-06-13T19:00:00Z",
      bookmakers: [partial, h2hBook(1.6, 4.0, 6.0)],
    };
    expect(parseOddsEvents([ev] as never)[0]).toMatchObject({ decimalHome: 1.6, decimalAway: 6.0 });
  });
});

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

  it("picks the most-quoted line and medians its prices across bookmakers", () => {
    const book = (point: number, over: number, under: number) => ({
      markets: [
        { key: "totals", outcomes: [{ name: "Over", price: over, point }, { name: "Under", price: under, point }] },
      ],
    });
    const ev = {
      home_team: "Brazil",
      away_team: "Mexico",
      commence_time: "2026-06-13T19:00:00Z",
      // Three books on 2.5, one outlier on 3.5 → consensus line is 2.5.
      bookmakers: [book(2.5, 1.8, 2.0), book(2.5, 1.9, 1.95), book(2.5, 2.0, 1.85), book(3.5, 3.0, 1.4)],
    };
    const out = parseTotalsEvents([ev] as never);
    expect(out[0]).toMatchObject({ totalLine: 2.5, decimalOver: 1.9, decimalUnder: 1.95 });
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

  it("medians each team's price across every bookmaker", () => {
    const book = (bra: number, fra: number) => ({
      markets: [{ key: "outrights", outcomes: [{ name: "Brazil", price: bra }, { name: "France", price: fra }] }],
    });
    const raw = [
      {
        home_team: "",
        away_team: "",
        commence_time: "2026-07-19T19:00:00Z",
        bookmakers: [book(5, 6), book(5.5, 7), book(6, 8)],
      },
    ];
    expect(parseOutrights(raw as never)).toEqual([
      { teamName: "Brazil", decimal: 5.5 },
      { teamName: "France", decimal: 7 },
    ]);
  });

  it("returns empty when there is no outrights market", () => {
    expect(parseOutrights([] as never)).toEqual([]);
  });
});
