// Pure line-assembly for the Match Day Pickem challenge's "match updates" feed,
// which has no pool/chat to read SYSTEM messages from. It rebuilds the same goal /
// red-card / full-time lines the poller announces to pools (lib/sports/poll.ts)
// from the underlying MatchEvent + Result data, reusing the formatters in
// lib/pool/chat-events.ts. DB-free so it stays unit-testable; the one prisma read +
// cross-match merge lives in lib/challenge/md3-dashboard.ts (getRecentMatchUpdates).

import type { EventType, ResultStatus } from "@/generated/prisma/enums";
import {
  formatGoalLine,
  formatCardLine,
  formatFinalLine,
  minuteTag,
  type AnnouncedEvent,
} from "@/lib/pool/chat-events";

export interface MatchUpdateLine {
  line: string;
  // MatchEvents carry only a match minute, not a wall clock, so the mono label is
  // the minute tag ("78'", "45+2'") or "FT" / "LIVE" rather than a time of day.
  tag: string;
}

export interface MatchUpdate extends MatchUpdateLine {
  key: string;
}

export interface MatchUpdateResult {
  status: ResultStatus;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
}

const GOAL_TYPES: ReadonlySet<EventType> = new Set([
  "GOAL",
  "PENALTY_GOAL",
  "OWN_GOAL",
] as EventType[]);

// Chronological (oldest→newest) update lines for one match: walk events in
// (minute, extraMinute) order keeping a running home/away tally so each goal line
// shows the score AFTER it (matching the poller, which passes the live fixture
// score), then append the full-time line once FINAL.
export function buildMatchUpdateLines(
  homeCode: string,
  awayCode: string,
  result: MatchUpdateResult,
  events: AnnouncedEvent[],
): MatchUpdateLine[] {
  const sorted = [...events].sort(
    (a, b) => a.minute - b.minute || (a.extraMinute ?? 0) - (b.extraMinute ?? 0),
  );
  const out: MatchUpdateLine[] = [];
  let home = 0;
  let away = 0;
  for (const e of sorted) {
    const tag = minuteTag(e.minute, e.extraMinute);
    if (GOAL_TYPES.has(e.type)) {
      // A normal/penalty goal credits the scorer's side; an own goal credits the
      // opponent (the scorer's team conceded).
      const scorerIsHome = e.teamCode === homeCode;
      const benefitsHome = e.type === "OWN_GOAL" ? !scorerIsHome : scorerIsHome;
      if (benefitsHome) home += 1;
      else away += 1;
      const line = formatGoalLine(e, homeCode, awayCode, home, away);
      if (line) out.push({ line, tag });
      continue;
    }
    const card = formatCardLine(e);
    if (card) out.push({ line: card, tag });
  }
  if (result.status === "FINAL") {
    out.push({
      line: formatFinalLine(
        homeCode,
        awayCode,
        result.homeScore ?? home,
        result.awayScore ?? away,
      ),
      tag: "FT",
    });
  } else if (result.status === "LIVE" && out.length === 0) {
    // Live but no goal/card events yet — a compact current-score line so the match
    // still appears on the feed.
    out.push({
      line: `⏱ ${homeCode} ${result.homeScore ?? 0}–${result.awayScore ?? 0} ${awayCode}`,
      tag: result.elapsed != null ? `${result.elapsed}'` : "LIVE",
    });
  }
  return out;
}
