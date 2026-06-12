import React from "react";

const base = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  letterSpacing: "-0.005em",
  border: "1px solid transparent",
  borderRadius: "var(--radius-pill)",
  cursor: "pointer",
  transition: "background-color var(--dur-2) var(--ease-standard), transform var(--dur-1) var(--ease-standard), box-shadow var(--dur-2) var(--ease-standard), opacity var(--dur-2) var(--ease-standard)",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const sizes = {
  sm: { height: "32px", padding: "0 14px", fontSize: "13px" },
  md: { height: "40px", padding: "0 18px", fontSize: "14px" },
  lg: { height: "52px", padding: "0 26px", fontSize: "16px" },
};

const variants = {
  primary: {
    background: "var(--pitch)",
    color: "var(--text-on-brand)",
    boxShadow: "var(--shadow-xs)",
  },
  secondary: {
    background: "var(--surface)",
    color: "var(--ink)",
    borderColor: "var(--line)",
  },
  gold: {
    background: "var(--gold)",
    color: "var(--text-on-gold)",
    boxShadow: "var(--shadow-xs)",
  },
  ghost: {
    background: "transparent",
    color: "var(--ink-2)",
  },
  danger: {
    background: "var(--negative)",
    color: "#fff",
  },
};

const hoverBg = {
  primary: "var(--pitch-dark)",
  secondary: "var(--surface-sunk)",
  gold: "var(--gold-dark)",
  ghost: "var(--surface-sunk)",
  danger: "#8a0019",
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  children,
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const isDisabled = disabled || loading;

  const style = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...(hover && !isDisabled ? { background: hoverBg[variant] } : null),
    ...(active && !isDisabled ? { transform: "scale(0.97)" } : null),
    ...(block ? { display: "flex", width: "100%" } : null),
    ...(isDisabled ? { opacity: 0.5, cursor: "not-allowed" } : null),
  };

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={style}
      disabled={isDisabled}
    >
      {loading ? (
        <span
          aria-hidden
          style={{
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid currentColor", borderTopColor: "transparent",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : null}
      {children}
    </button>
  );
}
