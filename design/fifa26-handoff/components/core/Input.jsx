import React from "react";

export function Input({
  value, defaultValue, onChange, placeholder, type = "text",
  prefix, suffix, size = "md", variant = "default",
  disabled, name, maxLength, required,
}) {
  const [focus, setFocus] = React.useState(false);
  const isPill = variant === "pill";
  const heights = { md: 44, lg: 52 };
  const wrap = {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--surface)",
    border: `1px solid ${focus ? "var(--pitch)" : "var(--line)"}`,
    borderRadius: isPill ? "var(--radius-pill)" : "var(--radius-md)",
    padding: isPill ? "0 6px 0 18px" : "0 12px",
    height: heights[size],
    transition: "border-color var(--dur-2) var(--ease-standard), box-shadow var(--dur-2) var(--ease-standard)",
    boxShadow: focus ? "0 0 0 3px rgba(11,107,58,0.15)" : "none",
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <div style={wrap}>
      {prefix ? <span style={{ color: "var(--ink-3)", display: "flex" }}>{prefix}</span> : null}
      <input
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        name={name}
        maxLength={maxLength}
        required={required}
        style={{
          flex: 1, minWidth: 0,
          border: "none", outline: "none", background: "transparent",
          fontFamily: "var(--font-body)", fontSize: 15,
          color: "var(--ink)",
        }}
      />
      {suffix ? <span style={{ display: "flex" }}>{suffix}</span> : null}
    </div>
  );
}
