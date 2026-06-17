import { describe, it, expect } from "vitest";
import { resolveBoardPlayer, buildPlayerGoals, type BoardScorer, type RawGoalEvent } from "./player-goals";

const board: BoardScorer[] = [
  { rank: 1, playerName: "Kylian Mbappé", teamCode: "FRA", goals: 5, assists: 2 },
  { rank: 2, playerName: "Harry Kane", teamCode: "ENG", goals: 4, assists: 1 },
];

describe("resolveBoardPlayer", () => {
  it("matches on the normalized name, ignoring case and diacritics", () => {
    expect(resolveBoardPlayer("kylian mbappe", board)?.teamCode).toBe("FRA");
    expect(resolveBoardPlayer("Kylian Mbappé", board)?.rank).toBe(1);
  });

  it("returns null for an unknown name or empty input", () => {
    expect(resolveBoardPlayer("Lionel Messi", board)).toBeNull();
    expect(resolveBoardPlayer("   ", board)).toBeNull();
  });
});

function goal(partial: Partial<RawGoalEvent> & { matchNo: number }): RawGoalEvent {
  return {
    playerName: "Kylian Mbappé",
    type: "GOAL",
    minute: 10,
    extraMinute: null,
    teamCode: "FRA",
    roundCode: "GROUP",
    homeTeamCode: "FRA",
    awayTeamCode: "MEX",
    ...partial,
  };
}

describe("buildPlayerGoals", () => {
  it("filters to the player, flags penalties, and resolves the opponent", () => {
    const events = [
      goal({ matchNo: 5, type: "PENALTY_GOAL", minute: 30 }),
      goal({ matchNo: 5, playerName: "Someone Else" }),
      goal({ matchNo: 9, teamCode: "FRA", homeTeamCode: "BRA", awayTeamCode: "FRA" }),
    ];
    const goals = buildPlayerGoals(events, "Kylian Mbappé");
    expect(goals).toHaveLength(2);
    expect(goals[0]).toMatchObject({ matchNo: 5, penalty: true, opponentCode: "MEX" });
    // Opponent is the *other* side even when the player's team is away.
    expect(goals[1]).toMatchObject({ matchNo: 9, opponentCode: "BRA" });
  });

  it("sorts by match, then minute, then extra time", () => {
    const events = [
      goal({ matchNo: 9, minute: 90, extraMinute: 3 }),
      goal({ matchNo: 9, minute: 90, extraMinute: 1 }),
      goal({ matchNo: 2, minute: 88 }),
    ];
    const order = buildPlayerGoals(events, "Kylian Mbappé").map(
      (g) => `${g.matchNo}:${g.minute}+${g.extraMinute ?? 0}`,
    );
    expect(order).toEqual(["2:88+0", "9:90+1", "9:90+3"]);
  });

  it("matches by normalized name and skips events with no scorer", () => {
    const events = [goal({ matchNo: 1, playerName: "kylian mbappe" }), goal({ matchNo: 2, playerName: null })];
    expect(buildPlayerGoals(events, "Kylian Mbappé")).toHaveLength(1);
  });
});
