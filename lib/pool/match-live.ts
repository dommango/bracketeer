// Pure display models for the live/finished match detail: a chronological
// goal-and-card timeline from MatchEvent rows, and a paired team-stats bar from
// the MatchStats Json. DB-free so it's unit-testable; the prisma selector
// (getMatchDetail) loads the rows and resolves home/away codes before calling in.

import type { EventType } from "@/generated/prisma/enums";
import type { RawTeamStats } from "@/lib/sports/client";

export type EventSide = "home" | "away" | "unknown";
export type TimelineKind = "goal" | "card" | "sub";

// One MatchEvent row as it comes out of the DB (Prisma MatchEvent shape).
export interface EventInput {
  minute: number;
  extraMinute: number | null;
  type: EventType;
  teamCode: string;
  playerName: string | null;
  assistName: string | null;
}

export interface TimelineItem {
  minuteLabel: string; // "23'" or "45+2'"
  sortKey: number; // minute*100 + extraMinute, for stable ordering
  type: EventType;
  kind: TimelineKind;
  icon: string; // emoji glyph for the event
  side: EventSide;
  teamCode: string;
  player: string | null;
  note: string | null; // assist / "Penalty" / "Own goal" / "Missed penalty"
}

const GOAL_TYPES: ReadonlySet<EventType> = new Set([
  "GOAL",
  "PENALTY_GOAL",
  "OWN_GOAL",
] as EventType[]);

const ICON: Record<EventType, string> = {
  GOAL: "\u{26BD}", // ⚽
  PENALTY_GOAL: "\u{26BD}",
  OWN_GOAL: "\u{26BD}",
  PENALTY_MISSED: "\u{274C}", // ❌
  YELLOW_CARD: "\u{1F7E8}", // 🟨
  RED_CARD: "\u{1F7E5}", // 🟥
  YELLOW_RED_CARD: "\u{1F7E5}",
  SUBSTITUTION: "\u{1F501}", // 🔁
};

function kindOf(type: EventType): TimelineKind {
  if (GOAL_TYPES.has(type) || type === "PENALTY_MISSED") return "goal";
  if (type === "SUBSTITUTION") return "sub";
  return "card";
}

function noteOf(e: EventInput): string | null {
  switch (e.type) {
    case "PENALTY_GOAL":
      return "Penalty";
    case "PENALTY_MISSED":
      return "Missed penalty";
    case "OWN_GOAL":
      return "Own goal";
    case "GOAL":
      return e.assistName ? `Assist: ${e.assistName}` : null;
    case "YELLOW_RED_CARD":
      return "Second yellow";
    default:
      return null;
  }
}

function minuteLabel(minute: number, extra: number | null): string {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

function sideOf(teamCode: string, homeCode: string | null, awayCode: string | null): EventSide {
  if (homeCode && teamCode === homeCode) return "home";
  if (awayCode && teamCode === awayCode) return "away";
  return "unknown";
}

// API-Football attributes an own goal to the conceding team (the player who put
// it in their own net). Broadcast convention — and the score that actually moved
// — puts the goal on the *benefiting* side, so we flip it. The conceding player's
// name still rides along with the "Own goal" note.
function resolveSide(e: EventInput, homeCode: string | null, awayCode: string | null): EventSide {
  const raw = sideOf(e.teamCode, homeCode, awayCode);
  if (e.type === "OWN_GOAL") {
    if (raw === "home") return "away";
    if (raw === "away") return "home";
  }
  return raw;
}

// Build the chronological timeline. Substitutions are dropped — without lineup
// context they're noise; goals and cards are what the pool cares about. The data
// path stays open (kindOf still classifies subs) if we want to surface them later.
export function buildTimeline(
  events: EventInput[],
  homeCode: string | null,
  awayCode: string | null,
): TimelineItem[] {
  return events
    .filter((e) => e.type !== "SUBSTITUTION")
    .map((e) => ({
      minuteLabel: minuteLabel(e.minute, e.extraMinute),
      sortKey: e.minute * 100 + (e.extraMinute ?? 0),
      type: e.type,
      kind: kindOf(e.type),
      icon: ICON[e.type] ?? "•",
      side: resolveSide(e, homeCode, awayCode),
      teamCode: e.teamCode,
      player: e.playerName,
      note: noteOf(e),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

// --- Team stats bars -------------------------------------------------------

// MatchStats.home / .away are stored verbatim as the poller's RawTeamStats Json.
// Aliasing the producer's type links the two at compile time, so a future field
// change there can't silently desync the Json→TeamStatValues cast in getMatchDetail.
export type TeamStatValues = RawTeamStats;

export interface StatBar {
  key: string;
  label: string;
  home: number;
  away: number;
  homePct: number; // home's share of the row total (0–100), for bar width
  suffix: string; // "%" for possession, "" otherwise
}

const STAT_ROWS: { key: keyof TeamStatValues; label: string; suffix: string }[] = [
  { key: "possession", label: "Possession", suffix: "%" },
  { key: "shots", label: "Shots", suffix: "" },
  { key: "shotsOnTarget", label: "Shots on target", suffix: "" },
  { key: "corners", label: "Corners", suffix: "" },
  { key: "fouls", label: "Fouls", suffix: "" },
];

// Build the stat-bar rows. A row is dropped when neither side has a value, so an
// early/sparse feed shows only the stats it actually has.
export function buildStatBars(
  home: TeamStatValues | null,
  away: TeamStatValues | null,
): StatBar[] {
  if (!home && !away) return [];
  return STAT_ROWS.flatMap(({ key, label, suffix }) => {
    const h = home?.[key] ?? null;
    const a = away?.[key] ?? null;
    if (h == null && a == null) return [];
    const hv = h ?? 0;
    const av = a ?? 0;
    const total = hv + av;
    const homePct = total > 0 ? Math.round((hv / total) * 100) : 50;
    return [{ key, label, home: hv, away: av, homePct, suffix }];
  });
}
