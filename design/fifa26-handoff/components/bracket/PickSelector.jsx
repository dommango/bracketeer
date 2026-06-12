import React from "react";
import { TEAM_TO_ISO2 } from "./Flag";

function Option({ opt, picked, onPick }) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const iso2 = TEAM_TO_ISO2[opt.code];
  return (
    <button
      onClick={() => onPick(opt.code)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        flex: 1, minWidth: 0,
        minHeight: "var(--hit-min)",
        padding: "14px 12px",
        background: picked ? "var(--pitch)" : (hover ? "var(--pitch-tint)" : "var(--surface)"),
        color: picked ? "#fff" : "var(--ink)",
        border: `2px solid ${picked ? "var(--pitch)" : "var(--line)"}`,
        borderRadius: "var(--radius-lg)",
        fontFamily: "var(--font-body)",
        cursor: "pointer",
        transform: active ? "scale(0.97)" : "scale(1)",
        transition: "all var(--dur-2) var(--ease-standard)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      }}
    >
      {iso2 ? (
        <img src={`https://flagcdn.com/${iso2}.svg`} alt={opt.code} width={48} height={36} loading="lazy"
          style={{ borderRadius: 6, objectFit: "cover", boxShadow: "inset 0 0 0 1px rgba(10,15,13,0.10)" }} />
      ) : opt.flag ? <span style={{ fontSize: 28, lineHeight: 1 }}>{opt.flag}</span> : null}
      <span style={{
        fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.02em",
      }}>{opt.code}</span>
      <span style={{
        fontSize: 12, fontWeight: 500,
        color: picked ? "rgba(255,255,255,0.85)" : "var(--ink-3)",
      }}>{opt.name}</span>
    </button>
  );
}

export function PickSelector({ title, kickoff, caption, options, value, onPick }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-xl)",
      padding: 14,
      fontFamily: "var(--font-body)",
    }}>
      {caption ? (
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--ink-3)", marginBottom: 6,
        }}>{caption}</div>
      ) : null}
      {title ? (
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{title}</div>
      ) : null}
      {kickoff ? (
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{kickoff}</div>
      ) : null}
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "stretch" }}>
        <Option opt={options[0]} picked={value === options[0].code} onPick={onPick} />
        <div style={{
          alignSelf: "center", fontFamily: "var(--font-display)",
          fontSize: 12, color: "var(--ink-3)",
        }}>vs</div>
        <Option opt={options[1]} picked={value === options[1].code} onPick={onPick} />
      </div>
    </div>
  );
}
