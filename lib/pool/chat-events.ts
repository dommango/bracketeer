// Auto-posted match events → pool chat: pure, unit-tested formatters that build
// the one-line SYSTEM message. DB-free so importing it in tests doesn't pull in
// prisma/env; the poller does the fan-out (announceToAllPools) with these strings.

import type { EventType } from "@/generated/prisma/enums";

export interface AnnouncedEvent {
  type: EventType;
  teamCode: string;
  playerName: string | null;
  minute: number;
  extraMinute: number | null;
}

const GOAL_TYPES: ReadonlySet<EventType> = new Set([
  "GOAL",
  "PENALTY_GOAL",
  "OWN_GOAL",
] as EventType[]);

export function minuteTag(minute: number, extra: number | null): string {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

// Score string with the team that just scored in bold-ish caps; codes keep it
// compact for a chat line.
function scoreLine(homeCode: string, awayCode: string, home: number, away: number): string {
  return `${homeCode} ${home}–${away} ${awayCode}`;
}

// A goal line, or null for non-goal events. `home`/`away` are the running score
// AFTER this goal.
export function formatGoalLine(
  e: AnnouncedEvent,
  homeCode: string,
  awayCode: string,
  home: number,
  away: number,
): string | null {
  if (!GOAL_TYPES.has(e.type)) return null;
  const note =
    e.type === "PENALTY_GOAL" ? " (pen)" : e.type === "OWN_GOAL" ? " (OG)" : "";
  const who = e.playerName ? ` ${e.playerName}${note}` : note;
  return `⚽ GOAL  ${scoreLine(homeCode, awayCode, home, away)} — ${e.teamCode}${who} ${minuteTag(e.minute, e.extraMinute)}`;
}

// A red-card line, or null for everything else (yellows are deliberately muted
// to keep the feed signal-heavy).
export function formatCardLine(e: AnnouncedEvent): string | null {
  if (e.type !== "RED_CARD" && e.type !== "YELLOW_RED_CARD") return null;
  const who = e.playerName ?? e.teamCode;
  return `🟥 RED  ${who} (${e.teamCode}) sent off ${minuteTag(e.minute, e.extraMinute)}`;
}

export function formatFinalLine(
  homeCode: string,
  awayCode: string,
  home: number,
  away: number,
): string {
  return `⏱ FT  ${scoreLine(homeCode, awayCode, home, away)}`;
}
