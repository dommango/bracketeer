import React from "react";

const RADII = {
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
};

const PADS = {
  none: 0,
  sm: "var(--space-4)",
  md: "var(--space-5)",
  lg: "var(--space-7)",
};

const VARIANTS = {
  flat:   { background: "var(--surface)",      border: "1px solid var(--line)",       color: "var(--ink)" },
  raised: { background: "var(--surface)",      boxShadow: "var(--shadow-md)",         color: "var(--ink)" },
  brand:  { background: "var(--pitch)",        color: "#fff" },
  sunk:   { background: "var(--surface-sunk)", color: "var(--ink)" },
  dashed: { background: "var(--surface)",      border: "1px dashed var(--line)",       color: "var(--ink-3)" },
};

export function Card({
  variant = "flat",
  padding = "md",
  radius = "lg",
  accent,
  as: Tag = "div",
  children,
  className,
  onClick,
}) {
  const style = {
    borderRadius: RADII[radius],
    padding: PADS[padding],
    fontFamily: "var(--font-body)",
    ...VARIANTS[variant],
  };
  if (accent) {
    style.borderLeft = `4px solid var(--${accent})`;
  }
  return (
    <Tag style={style} className={className} onClick={onClick}>{children}</Tag>
  );
}
