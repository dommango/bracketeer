import React from "react";
import { TEAM_TO_ISO2 } from "./Flag";

export function TeamRow({ name, code, score, isWinner, isLoser, flag, onPick, pickable, picked }) {
  const [hover, setHover] = React.useState(false);
  const dimmed = isLoser && !isWinner;
  const iso2 = code && TEAM_TO_ISO2[code];
  const style = {
    display: "flex", alignItems: "center", gap: 10,
    minHeight: pickable ? "var(--hit-min)" : "32px",
    padding: pickable ? "8px 12px" : "4px 0",
    borderRadius: pickable ? "var(--radius-md)" : 0,
    background: picked ? "var(--pitch-tint)" : (hover && pickable ? "var(--surface-sunk)" : "transparent"),
    border: pickable ? `2px solid ${picked ? "var(--pitch)" : "transparent"}` : "none",
    cursor: pickable ? "pointer" : "default",
    color: dimmed ? "var(--ink-4)" : "var(--ink)",
    transition: "background var(--dur-2) var(--ease-standard), border-color var(--dur-2) var(--ease-standard)",
    fontFamily: "var(--font-body)",
  };
  return (
    <div
      role={pickable ? "button" : undefined}
      tabIndex={pickable ? 0 : undefined}
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={style}
    >
      {iso2 ? (
        <img src={`https://flagcdn.com/${iso2}.svg`} alt={code} width={20} height={15} loading="lazy"
          style={{ borderRadius: 3, objectFit: "cover", boxShadow: "inset 0 0 0 1px rgba(10,15,13,0.08)", flexShrink: 0 }} />
      ) : flag ? <span style={{ fontSize: 18, lineHeight: 1 }}>{flag}</span> : null}
      <span style={{
        fontWeight: isWinner ? 700 : 500,
        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {name}
        {code ? <span style={{
          marginLeft: 6, fontFamily: "var(--font-mono)", fontSize: 10,
          color: dimmed ? "var(--ink-4)" : "var(--ink-3)",
        }}>{code}</span> : null}
      </span>
      {picked ? (
        <span style={{
          fontFamily: "var(--font-display)", fontSize: 11,
          color: "var(--pitch)", letterSpacing: "0.08em",
        }}>PICKED</span>
      ) : null}
      {score != null ? (
        <span style={{
          fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums",
          fontWeight: 700, fontSize: 16, minWidth: 18, textAlign: "right",
        }}>{score}</span>
      ) : null}
    </div>
  );
}
