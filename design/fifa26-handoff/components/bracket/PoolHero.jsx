import React from "react";
import { Badge } from "../core/Badge";

const STATUS = {
  upcoming: { tone: "gold",    label: "Upcoming" },
  live:     { tone: "live",    label: "Live" },
  final:    { tone: "neutral", label: "Final" },
};

export function PoolHero({
  eyebrow, title, subtitle, metric, pattern, patternSrc,
  status, actions,
}) {
  const s = status ? STATUS[status] : null;
  return (
    <div style={{
      position: "relative",
      background: "var(--pitch)",
      color: "#fff",
      borderRadius: "var(--radius-2xl)",
      padding: "24px 22px",
      overflow: "hidden",
      fontFamily: "var(--font-body)",
    }}>
      {pattern ? (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${patternSrc || "../../assets/brand-26-pattern.avif"})`,
          backgroundSize: "cover", backgroundPosition: "center",
        }} />
      ) : null}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
      }} />
      <div style={{ position: "relative" }}>
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow ? (
              <div style={{
                color: "var(--gold)", fontSize: 11, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>{eyebrow}</div>
            ) : null}
            <h1 style={{
              margin: "4px 0 0 0",
              fontFamily: "var(--font-display)",
              fontSize: 28, lineHeight: 1.05,
              wordBreak: "break-word",
            }}>{title}</h1>
            {subtitle ? (
              <p style={{
                margin: "10px 0 0 0",
                fontSize: 14, lineHeight: 1.4,
                color: "rgba(255,255,255,0.8)",
              }}>{subtitle}</p>
            ) : null}
          </div>
          {s ? <Badge tone={s.tone} variant="solid" size="md">{s.label}</Badge> : null}
        </div>
        {metric ? (
          <div style={{
            marginTop: 16,
            display: "inline-flex", flexDirection: "column",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(8px)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "rgba(255,255,255,0.7)",
            }}>{metric.label}</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22,
              letterSpacing: "0.1em",
            }}>{metric.value}</span>
          </div>
        ) : null}
        {actions ? (
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
