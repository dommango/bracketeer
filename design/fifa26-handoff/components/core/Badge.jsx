import React from "react";

const TONE = {
  neutral:  { solid: "var(--ink)",      soft: "var(--surface-sunk)",  text: "var(--ink-2)",   tint: "var(--ink-3)" },
  live:     { solid: "var(--live)",     soft: "var(--live-tint)",     text: "var(--live)",    tint: "var(--live)" },
  gold:     { solid: "var(--gold)",     soft: "var(--gold-tint)",     text: "var(--pitch-deep)", tint: "var(--gold-dark)" },
  positive: { solid: "var(--positive)", soft: "var(--positive-tint)", text: "var(--positive)", tint: "var(--positive)" },
  warning:  { solid: "var(--warning)",  soft: "var(--warning-tint)",  text: "var(--warning)", tint: "var(--warning)" },
  negative: { solid: "var(--negative)", soft: "var(--negative-tint)", text: "var(--negative)", tint: "var(--negative)" },
  brand:    { solid: "var(--pitch)",    soft: "var(--pitch-tint)",    text: "var(--pitch-dark)", tint: "var(--pitch)" },
};

const sizes = {
  sm: { height: "20px", padding: "0 8px",  fontSize: "10px", letterSpacing: "0.08em" },
  md: { height: "24px", padding: "0 10px", fontSize: "11px", letterSpacing: "0.06em" },
};

export function Badge({ tone = "neutral", variant = "soft", size = "md", children }) {
  const t = TONE[tone];
  const style = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "var(--radius-pill)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    textTransform: "uppercase",
    ...sizes[size],
  };
  if (variant === "solid") {
    style.background = t.solid;
    style.color = tone === "gold" ? "var(--pitch-deep)" : "#fff";
  } else if (variant === "soft") {
    style.background = t.soft;
    style.color = t.text;
  } else {
    style.background = "transparent";
    style.color = t.text;
    style.border = `1px solid ${t.tint}`;
  }
  return (
    <span style={style}>
      {tone === "live" ? (
        <span aria-hidden style={{
          width: 6, height: 6, borderRadius: 999, background: "currentColor",
          boxShadow: "0 0 0 0 currentColor", animation: "pulse 1.4s ease-out infinite",
        }} />
      ) : null}
      {children}
    </span>
  );
}
