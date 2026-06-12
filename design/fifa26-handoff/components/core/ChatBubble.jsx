import React from "react";

function timeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatBubble({ body, authorName, timestamp, mine, authorColor }) {
  return (
    <div style={{
      display: "flex", justifyContent: mine ? "flex-end" : "flex-start",
      fontFamily: "var(--font-body)",
    }}>
      <div style={{
        maxWidth: "80%",
        background: mine ? "var(--pitch)" : "var(--surface-sunk)",
        color: mine ? "#fff" : "var(--ink)",
        borderRadius: 16,
        borderBottomRightRadius: mine ? 4 : 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        padding: "8px 12px",
        fontSize: 14, lineHeight: 1.4,
      }}>
        {!mine && authorName ? (
          <div style={{
            fontWeight: 700, fontSize: 11, letterSpacing: "0.04em",
            color: authorColor ? `var(--${authorColor})` : "var(--pitch-dark)",
            marginBottom: 2,
          }}>{authorName}</div>
        ) : null}
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{body}</div>
        {timestamp ? (
          <div style={{
            marginTop: 4, fontSize: 10,
            color: mine ? "rgba(255,255,255,0.6)" : "var(--ink-3)",
            textAlign: "right",
          }}>{timeLabel(timestamp)}</div>
        ) : null}
      </div>
    </div>
  );
}
