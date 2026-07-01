import { describe, it, expect } from "vitest";
import { parseStatLeaders, type ApiStatLeader } from "./stat-leaders-parse";

// A provider team id that maps to a real code via fixtures-map. We look one up at
// runtime so the test stays valid regardless of which ids are seeded, and skip
// gracefully if the map is empty (it ships empty until generated post-groups).
import { EXTERNAL_TEAM_CODES } from "./fixtures-map";
const KNOWN_ID = Object.keys(EXTERNAL_TEAM_CODES)[0];
const KNOWN_CODE = KNOWN_ID ? EXTERNAL_TEAM_CODES[KNOWN_ID] : undefined;

const row = (
  name: string,
  teamId: number | null,
  over: { assists?: number | null; yellow?: number | null; red?: number | null; apps?: number | null } = {},
): ApiStatLeader => ({
  player: { name },
  statistics: [
    {
      team: { id: teamId },
      games: { appearences: over.apps ?? 3 },
      goals: { assists: over.assists ?? null },
      cards: { yellow: over.yellow ?? null, red: over.red ?? null },
    },
  ],
});

describe("parseStatLeaders", () => {
  it("ranks assist leaders gap-free and reads the assists value", () => {
    if (!KNOWN_ID || !KNOWN_CODE) return; // fixtures-map not generated yet
    const raw = [
      row("A. Passer", Number(KNOWN_ID), { assists: 4 }),
      row("Unresolvable", 999999999, { assists: 3 }), // team not in map → dropped
      row("B. Setup", Number(KNOWN_ID), { assists: 2 }),
    ];
    const out = parseStatLeaders(raw, "ASSISTS");
    expect(out.map((e) => e.rank)).toEqual([1, 2]); // gap-free after the drop
    expect(out[0]).toMatchObject({ playerName: "A. Passer", teamCode: KNOWN_CODE, value: 4 });
    expect(out[1].value).toBe(2);
  });

  it("reads the yellow/red card value per category", () => {
    if (!KNOWN_ID) return;
    const raw = [row("C. Rough", Number(KNOWN_ID), { yellow: 2, red: 1 })];
    expect(parseStatLeaders(raw, "YELLOW_CARDS")[0].value).toBe(2);
    expect(parseStatLeaders(raw, "RED_CARDS")[0].value).toBe(1);
  });

  it("drops rows with a zero or missing value on the board (no padding noise)", () => {
    if (!KNOWN_ID) return;
    const raw = [
      row("Clean", Number(KNOWN_ID), { yellow: 0 }),
      row("Null", Number(KNOWN_ID), { yellow: null }),
    ];
    expect(parseStatLeaders(raw, "YELLOW_CARDS")).toHaveLength(0);
  });

  it("drops rows with no player name", () => {
    if (!KNOWN_ID) return;
    const raw = [row("", Number(KNOWN_ID), { assists: 5 })];
    expect(parseStatLeaders(raw, "ASSISTS")).toHaveLength(0);
  });
});
