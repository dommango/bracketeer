import React from "react";

export function Tabs({ items, value, onChange, variant = "pill" }) {
  if (variant === "pill") {
    return (
      <div style={{
        display: "flex", gap: 4, padding: 4,
        background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--line)",
        overflowX: "auto",
      }}>
        {items.map(([id, label]) => {
          const active = id === value;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              style={{
                whiteSpace: "nowrap",
                padding: "8px 16px",
                borderRadius: "var(--radius-pill)",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 13,
                background: active ? "var(--pitch)" : "transparent",
                color: active ? "#fff" : "var(--ink-2)",
                transition: "background var(--dur-2) var(--ease-standard), color var(--dur-2) var(--ease-standard)",
              }}
            >{label}</button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--line)" }}>
      {items.map(([id, label]) => {
        const active = id === value;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14,
              padding: "10px 0",
              color: active ? "var(--ink)" : "var(--ink-3)",
              borderBottom: `2px solid ${active ? "var(--pitch)" : "transparent"}`,
              marginBottom: "-1px",
            }}
          >{label}</button>
        );
      })}
    </div>
  );
}
