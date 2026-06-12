import React from "react";

const GROUP_COLOR = {
  A: "city-mexico-city",
  B: "city-vancouver",
  C: "city-atlanta",
  D: "city-houston",
  E: "city-philadelphia",
  F: "city-los-angeles",
  G: "city-guadalajara",
  H: "city-kansas-city",
  I: "city-monterrey",
  J: "city-san-francisco",
  K: "city-boston",
  L: "city-new-york-nj",
};

const sizes = {
  sm: { size: 22, fs: 11 },
  md: { size: 28, fs: 13 },
  lg: { size: 40, fs: 18 },
};

export function GroupChip({ group, size = "md" }) {
  const { size: s, fs } = sizes[size];
  const color = `var(--${GROUP_COLOR[group] || "pitch"})`;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: s, height: s, borderRadius: "var(--radius-sm)",
      background: color, color: "#fff",
      fontFamily: "var(--font-display)", fontSize: fs, lineHeight: 1,
      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
    }}>{group}</span>
  );
}
