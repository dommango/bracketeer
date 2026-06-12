import React from "react";
import { TeamRow } from "./TeamRow";
import { Badge } from "../core/Badge";

export function MatchCard({
  matchNo, round, kickoff, status = "upcoming", minute,
  accent, home, away, winnerCode, pickedCode, pointsEarned,
}) {
  const decided = status === "final";
  const homeWin = decided && winnerCode === home.code;
  const awayWin = decided && winnerCode === away.code;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderLeft: accent ? `4px solid var(--${accent})` : "1px solid var(--line)",
      borderRadius: "var(--radius-md)",
      padding: "10px 14px",
      fontFamily: "var(--font-body)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6, gap: 8,
      }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)",
        }}>
          <span style={{ fontWeight: 700 }}>M{matchNo}</span>
          {round ? <span>· {round}</span> : null}
          {kickoff ? <span>· {kickoff}</span> : null}
        </div>
        {status === "live" ? (
          <Badge tone="live" variant="soft" size="sm">{minute ? `${minute}'` : "Live"}</Badge>
        ) : status === "final" ? (
          <Badge tone="neutral" variant="soft" size="sm">Final</Badge>
        ) : null}
      </div>
      <TeamRow {...home} isWinner={homeWin} isLoser={awayWin} />
      <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
      <TeamRow {...away} isWinner={awayWin} isLoser={homeWin} />
      {(pickedCode || pointsEarned != null) ? (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)",
          display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between",
          fontSize: 12, color: "var(--ink-3)",
        }}>
          {pickedCode ? (
            <span>Your pick · <strong style={{ color: "var(--ink)" }}>{pickedCode}</strong></span>
          ) : <span />}
          {pointsEarned != null ? (
            <Badge tone={pointsEarned > 0 ? "positive" : "neutral"} variant="soft" size="sm">
              {pointsEarned > 0 ? `+${pointsEarned} pts` : "0 pts"}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
