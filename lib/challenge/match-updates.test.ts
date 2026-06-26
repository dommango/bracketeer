import { describe, it, expect } from "vitest";
import { buildMatchUpdateLines } from "./match-updates";
import type { AnnouncedEvent } from "@/lib/pool/chat-events";

// A minimal event helper — only the fields buildMatchUpdateLines reads.
function ev(partial: Partial<AnnouncedEvent> & { type: AnnouncedEvent["type"]; teamCode: string; minute: number }): AnnouncedEvent {
  return { playerName: null, extraMinute: null, ...partial };
}

describe("buildMatchUpdateLines", () => {
  it("walks events keeping a running tally, then appends a full-time line", () => {
    const events: AnnouncedEvent[] = [
      ev({ type: "GOAL", teamCode: "ARG", playerName: "Messi", minute: 23 }),
      ev({ type: "OWN_GOAL", teamCode: "ARG", playerName: "Otamendi", minute: 41 }),
      ev({ type: "GOAL", teamCode: "MEX", playerName: "Lozano", minute: 67 }),
    ];
    const lines = buildMatchUpdateLines(
      "MEX",
      "ARG",
      { status: "FINAL", homeScore: 2, awayScore: 1, elapsed: null },
      events,
    );

    expect(lines.map((l) => l.line)).toEqual([
      // ARG scores: 0–1 (away). teamCode shown is the scorer's.
      "⚽ GOAL  MEX 0–1 ARG — ARG Messi 23'",
      // Argentina own goal credits MEX → 1–1.
      "⚽ GOAL  MEX 1–1 ARG — ARG Otamendi (OG) 41'",
      // MEX scores → 2–1.
      "⚽ GOAL  MEX 2–1 ARG — MEX Lozano 67'",
      "⏱ FT  MEX 2–1 ARG",
    ]);
    expect(lines.map((l) => l.tag)).toEqual(["23'", "41'", "67'", "FT"]);
  });

  it("emits red cards and ignores yellows; sorts by minute/extra", () => {
    const events: AnnouncedEvent[] = [
      ev({ type: "RED_CARD", teamCode: "ESP", playerName: "Ramos", minute: 78 }),
      ev({ type: "YELLOW_CARD", teamCode: "ESP", playerName: "Busquets", minute: 30 }),
      ev({ type: "GOAL", teamCode: "ESP", minute: 90, extraMinute: 2 }),
    ];
    const lines = buildMatchUpdateLines(
      "ESP",
      "GER",
      { status: "FINAL", homeScore: 1, awayScore: 0, elapsed: null },
      events,
    );

    expect(lines.map((l) => l.line)).toEqual([
      "🟥 RED  Ramos (ESP) sent off 78'",
      "⚽ GOAL  ESP 1–0 GER — ESP 90+2'",
      "⏱ FT  ESP 1–0 GER",
    ]);
  });

  it("shows a compact live line when a live match has no goal/card events yet", () => {
    const lines = buildMatchUpdateLines(
      "BRA",
      "FRA",
      { status: "LIVE", homeScore: 0, awayScore: 0, elapsed: 12 },
      [],
    );
    expect(lines).toEqual([{ line: "⏱ BRA 0–0 FRA", tag: "12'" }]);
  });
});
