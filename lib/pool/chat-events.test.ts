import { describe, it, expect } from "vitest";
import {
  minuteTag,
  formatGoalLine,
  formatCardLine,
  formatFinalLine,
  type AnnouncedEvent,
} from "./chat-events";

function ev(p: Partial<AnnouncedEvent> & { type: AnnouncedEvent["type"]; teamCode: string }): AnnouncedEvent {
  return { playerName: null, minute: 30, extraMinute: null, ...p };
}

describe("minuteTag", () => {
  it("plain and stoppage-time minutes", () => {
    expect(minuteTag(23, null)).toBe("23'");
    expect(minuteTag(45, 2)).toBe("45+2'");
  });
});

describe("formatGoalLine", () => {
  it("formats a goal with scorer and running score", () => {
    const line = formatGoalLine(ev({ type: "GOAL", teamCode: "SCO", playerName: "McTominay", minute: 23 }), "HAI", "SCO", 0, 1);
    expect(line).toBe("⚽ GOAL  HAI 0–1 SCO — SCO McTominay 23'");
  });

  it("annotates penalties and own goals", () => {
    expect(formatGoalLine(ev({ type: "PENALTY_GOAL", teamCode: "HAI", playerName: "A" }), "HAI", "SCO", 1, 0)).toContain("(pen)");
    expect(formatGoalLine(ev({ type: "OWN_GOAL", teamCode: "SCO", playerName: "B" }), "HAI", "SCO", 1, 0)).toContain("(OG)");
  });

  it("returns null for non-goal events", () => {
    expect(formatGoalLine(ev({ type: "YELLOW_CARD", teamCode: "SCO" }), "HAI", "SCO", 0, 0)).toBeNull();
  });

  it("survives a missing scorer name", () => {
    const line = formatGoalLine(ev({ type: "GOAL", teamCode: "SCO", playerName: null, minute: 10 }), "HAI", "SCO", 0, 1);
    expect(line).toBe("⚽ GOAL  HAI 0–1 SCO — SCO 10'");
  });
});

describe("formatCardLine", () => {
  it("announces straight and second-yellow reds", () => {
    expect(formatCardLine(ev({ type: "RED_CARD", teamCode: "HAI", playerName: "X", minute: 60 }))).toBe(
      "🟥 RED  X (HAI) sent off 60'",
    );
    expect(formatCardLine(ev({ type: "YELLOW_RED_CARD", teamCode: "HAI", playerName: "Y", minute: 70 }))).toContain("RED");
  });

  it("ignores yellows and other events", () => {
    expect(formatCardLine(ev({ type: "YELLOW_CARD", teamCode: "HAI" }))).toBeNull();
    expect(formatCardLine(ev({ type: "GOAL", teamCode: "HAI" }))).toBeNull();
  });
});

describe("formatFinalLine", () => {
  it("formats the full-time score", () => {
    expect(formatFinalLine("HAI", "SCO", 1, 1)).toBe("⏱ FT  HAI 1–1 SCO");
  });
});
