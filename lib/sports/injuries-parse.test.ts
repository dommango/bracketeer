import { describe, it, expect } from "vitest";
import { parseInjuries, type ApiInjury } from "./injuries-parse";

// Team id 6 → BRA, 17 → KOR per EXTERNAL_TEAM_CODES.
describe("parseInjuries", () => {
  it("maps team ids to codes and reads player type/reason", () => {
    const resp: ApiInjury[] = [
      { player: { name: "Neymar", type: "Missing Fixture", reason: "Knee Injury" }, team: { id: 6 } },
      { player: { name: "Son", type: "Questionable", reason: "Suspended" }, team: { id: 17 } },
    ];
    expect(parseInjuries(resp)).toEqual([
      { teamCode: "BRA", playerName: "Neymar", type: "Missing Fixture", reason: "Knee Injury" },
      { teamCode: "KOR", playerName: "Son", type: "Questionable", reason: "Suspended" },
    ]);
  });

  it("drops entries with an unknown team or no player name", () => {
    const resp: ApiInjury[] = [
      { player: { name: "Ghost" }, team: { id: 999999 } }, // unknown team
      { player: { name: null }, team: { id: 6 } }, // no name
      { team: { id: 6 } }, // no player
      { player: { name: "  " }, team: { id: 6 } }, // blank name
    ];
    expect(parseInjuries(resp)).toEqual([]);
  });

  it("nulls blank/missing type and reason", () => {
    const resp: ApiInjury[] = [{ player: { name: "X", type: "", reason: "  " }, team: { id: 6 } }];
    expect(parseInjuries(resp)).toEqual([
      { teamCode: "BRA", playerName: "X", type: null, reason: null },
    ]);
  });
});
