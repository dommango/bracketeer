import { describe, it, expect } from "vitest";
import {
  buildTimeline,
  buildStatBars,
  teamScoreboardLines,
  type EventInput,
  type TeamStatValues,
} from "./match-live";

function ev(p: Partial<EventInput> & { type: EventInput["type"]; teamCode: string }): EventInput {
  return { minute: 10, extraMinute: null, playerName: null, assistName: null, ...p };
}

describe("teamScoreboardLines", () => {
  const timeline = buildTimeline(
    [
      ev({ type: "GOAL", teamCode: "SCO", minute: 45, playerName: "McTominay" }),
      ev({ type: "GOAL", teamCode: "SCO", minute: 45, extraMinute: 2, playerName: "McTominay" }),
      ev({ type: "PENALTY_MISSED", teamCode: "SCO", minute: 60, playerName: "Robertson" }),
      ev({ type: "OWN_GOAL", teamCode: "HAI", minute: 70, playerName: "Pierre" }),
      ev({ type: "YELLOW_CARD", teamCode: "HAI", minute: 12, playerName: "Saint" }),
      ev({ type: "RED_CARD", teamCode: "SCO", minute: 80, playerName: "Tierney" }),
    ],
    "HAI",
    "SCO",
  );

  it("groups a scorer's goals and excludes missed penalties", () => {
    const { scorers } = teamScoreboardLines(timeline, "away"); // SCO
    expect(scorers).toEqual([
      { label: "McTominay", minutes: ["45'", "45+2'"] },
      { label: "Pierre (OG)", minutes: ["70'"] }, // own goal credited to the benefiting side
    ]);
  });

  it("lists a team's cards with player and minute", () => {
    const home = teamScoreboardLines(timeline, "home"); // HAI
    expect(home.scorers).toEqual([]); // the own goal counts for the away side
    expect(home.cards.map((c) => `${c.player} ${c.minuteLabel}`)).toEqual(["Saint 12'"]);

    const away = teamScoreboardLines(timeline, "away"); // SCO
    expect(away.cards.map((c) => `${c.player} ${c.minuteLabel}`)).toEqual(["Tierney 80'"]);
  });
});

describe("buildTimeline", () => {
  it("orders by minute then extra minute and labels stoppage time", () => {
    const items = buildTimeline(
      [
        ev({ type: "GOAL", teamCode: "SCO", minute: 45, extraMinute: 2 }),
        ev({ type: "YELLOW_CARD", teamCode: "HAI", minute: 12 }),
        ev({ type: "GOAL", teamCode: "SCO", minute: 45, extraMinute: null }),
      ],
      "HAI",
      "SCO",
    );
    expect(items.map((i) => i.minuteLabel)).toEqual(["12'", "45'", "45+2'"]);
  });

  it("assigns home/away side from team codes, unknown otherwise", () => {
    const [a, b, c] = buildTimeline(
      [
        ev({ type: "GOAL", teamCode: "HAI" }),
        ev({ type: "GOAL", teamCode: "SCO", minute: 20 }),
        ev({ type: "GOAL", teamCode: "XXX", minute: 30 }),
      ],
      "HAI",
      "SCO",
    );
    expect([a.side, b.side, c.side]).toEqual(["home", "away", "unknown"]);
  });

  it("drops substitutions but keeps goals and cards", () => {
    const items = buildTimeline(
      [
        ev({ type: "SUBSTITUTION", teamCode: "HAI" }),
        ev({ type: "RED_CARD", teamCode: "HAI", minute: 60 }),
      ],
      "HAI",
      "SCO",
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("card");
  });

  it("flips an own goal to the benefiting side (the score that moved)", () => {
    // API attributes the OG to the conceding team (SCO = away); it should render
    // on the home side, since HAI is the team awarded the goal.
    const [og] = buildTimeline(
      [ev({ type: "OWN_GOAL", teamCode: "SCO", playerName: "Defender" })],
      "HAI",
      "SCO",
    );
    expect(og.side).toBe("home");
    expect(og.note).toBe("Own goal");
    expect(og.player).toBe("Defender");
  });

  it("annotates penalty, own goal, and assist notes", () => {
    const items = buildTimeline(
      [
        ev({ type: "PENALTY_GOAL", teamCode: "HAI" }),
        ev({ type: "OWN_GOAL", teamCode: "SCO", minute: 20 }),
        ev({ type: "GOAL", teamCode: "HAI", minute: 30, playerName: "A", assistName: "B" }),
      ],
      "HAI",
      "SCO",
    );
    expect(items.map((i) => i.note)).toEqual(["Penalty", "Own goal", "Assist: B"]);
  });
});

describe("buildStatBars", () => {
  const home: TeamStatValues = {
    possession: 60, shots: 8, shotsOnTarget: 3, corners: 5, fouls: 7, yellowCards: 1, redCards: 0,
  };
  const away: TeamStatValues = {
    possession: 40, shots: 4, shotsOnTarget: 1, corners: 2, fouls: 10, yellowCards: 2, redCards: 0,
  };

  it("returns one row per populated stat with home share percentage", () => {
    const bars = buildStatBars(home, away);
    expect(bars.map((b) => b.label)).toEqual([
      "Possession", "Shots", "Shots on target", "Corners", "Fouls",
    ]);
    expect(bars[0].homePct).toBe(60); // 60 / (60+40)
    expect(bars[0].suffix).toBe("%");
    expect(bars[1].homePct).toBe(67); // 8 / 12 ≈ 67
  });

  it("drops a row when neither side has the stat", () => {
    const sparse: TeamStatValues = {
      possession: 55, shots: null, shotsOnTarget: null, corners: null, fouls: null,
      yellowCards: null, redCards: null,
    };
    const bars = buildStatBars(sparse, { ...sparse, possession: 45 });
    expect(bars.map((b) => b.key)).toEqual(["possession"]);
  });

  it("returns empty when both sides are null", () => {
    expect(buildStatBars(null, null)).toEqual([]);
  });

  it("splits 50/50 when a row total is zero", () => {
    const zero: TeamStatValues = {
      possession: null, shots: 0, shotsOnTarget: null, corners: null, fouls: null,
      yellowCards: null, redCards: null,
    };
    const bars = buildStatBars(zero, zero);
    expect(bars[0].homePct).toBe(50);
  });
});
