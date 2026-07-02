import { describe, it, expect } from "vitest";
import { parseApiPlayer, parsePlayers, type ApiPlayer } from "./players-parse";
import { EXTERNAL_TEAM_CODES } from "./fixtures-map";

const KNOWN_ID = Object.keys(EXTERNAL_TEAM_CODES)[0];
const KNOWN_CODE = KNOWN_ID ? EXTERNAL_TEAM_CODES[KNOWN_ID] : undefined;

const player = (over: Partial<ApiPlayer["player"]> & { teamId?: number | null; rating?: string | null } = {}): ApiPlayer => ({
  player: {
    id: "id" in over ? over.id : 100,
    name: "name" in over ? over.name : "K. Mbappé",
    firstname: over.firstname ?? "Kylian",
    lastname: over.lastname ?? "Mbappé",
    age: over.age ?? 27,
    nationality: over.nationality ?? "France",
    height: over.height ?? "178 cm",
    photo: over.photo ?? "https://example/x.png",
  },
  statistics: [
    {
      team: { id: over.teamId ?? null },
      games: { appearences: 5, minutes: 450, position: "Attacker", rating: over.rating ?? "8.2" },
      goals: { total: 6, assists: 2 },
      shots: { total: 20 },
      cards: { yellow: 1, red: 0 },
    },
  ],
});

describe("parseApiPlayer", () => {
  it("pulls bio + season stats and parses the rating to a number", () => {
    const p = parseApiPlayer(player({ teamId: KNOWN_ID ? Number(KNOWN_ID) : 999 }));
    expect(p).toMatchObject({
      externalId: 100,
      playerName: "K. Mbappé",
      firstName: "Kylian",
      age: 27,
      position: "Attacker",
      appearances: 5,
      minutes: 450,
      goals: 6,
      assists: 2,
      shots: 20,
      rating: 8.2,
      yellowCards: 1,
      redCards: 0,
    });
    if (KNOWN_CODE) expect(p?.teamCode).toBe(KNOWN_CODE);
  });

  it("resolves teamCode to null when the provider team isn't in our map", () => {
    expect(parseApiPlayer(player({ teamId: 999999999 }))?.teamCode).toBeNull();
  });

  it("drops a row with no player id or no name", () => {
    expect(parseApiPlayer(player({ id: null }))).toBeNull();
    expect(parseApiPlayer(player({ name: "" }))).toBeNull();
  });

  it("parsePlayers skips the unparseable rows", () => {
    const out = parsePlayers([player(), player({ id: null }), player({ name: "  " })]);
    expect(out).toHaveLength(1);
  });
});
