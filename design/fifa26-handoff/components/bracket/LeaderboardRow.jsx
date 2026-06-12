import React from "react";

function medal(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
}

export function LeaderboardRow({
  rank, label, total, projected, isLeader, isYou, breakdown = [],
  initials, avatarColor = "pitch",
}) {
  const m = medal(rank);
  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${isLeader ? "var(--gold)" : "var(--line)"}`,
      boxShadow: isLeader ? "var(--shadow-ring-gold)" : "var(--shadow-xs)",
      borderRadius: "var(--radius-lg)",
      padding: "14px 16px",
      fontFamily: "var(--font-body)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          width: 32, textAlign: "center", fontFamily: "var(--font-display)",
          fontSize: m ? 22 : 18, color: m ? undefined : "var(--ink-3)",
        }}>{m ?? rank}</span>
        <span style={{
          width: 32, height: 32, borderRadius: "var(--radius-pill)",
          background: `var(--${avatarColor})`, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontSize: 13,
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}>{initials || label.slice(0, 2).toUpperCase()}</span>
        <span style={{
          flex: 1, minWidth: 0, fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: "var(--ink)",
        }}>
          {label}
          {isYou ? (
            <span style={{
              marginLeft: 8, padding: "1px 6px", borderRadius: "var(--radius-pill)",
              background: "var(--pitch-tint)", color: "var(--pitch-dark)",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            }}>YOU</span>
          ) : null}
        </span>
        <span style={{ textAlign: "right" }}>
          <span style={{
            fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)",
            fontVariantNumeric: "tabular-nums",
          }}>{total}</span>
          <span style={{ marginLeft: 4, fontSize: 11, color: "var(--ink-3)" }}>pts</span>
          {projected != null && projected !== 0 ? (
            <span style={{
              display: "block", marginTop: 2, fontSize: 11,
              color: projected > 0 ? "var(--positive)" : "var(--ink-3)",
              fontFamily: "var(--font-mono)",
            }}>
              {projected > 0 ? `▲ ${projected} live` : `· ${projected} live`}
            </span>
          ) : null}
        </span>
      </div>
      {breakdown.length > 0 ? (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          paddingLeft: 76,
        }}>
          {breakdown.filter(b => b.value > 0).map(b => (
            <span key={b.label} style={{
              background: "var(--pitch-tint)", color: "var(--pitch-dark)",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px", fontSize: 11, fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}>{b.label} {b.value}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
