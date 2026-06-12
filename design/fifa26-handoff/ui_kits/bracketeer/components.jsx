// Inline copies of the design-system components for the UI kit.
// These mirror the canonical sources under components/ — kept inline
// so the kit renders without depending on the compiled bundle's URL.
// Exposed on window.DS for use by the screens.

const { useState, useEffect, useRef } = React;

/* ------------------------------ Button ------------------------------ */
function Button({ variant = "primary", size = "md", block, loading, disabled, type = "button", onClick, children, style: extra }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const isDisabled = disabled || loading;
  const sizes = {
    sm: { height: 32, padding: "0 14px", fontSize: 13 },
    md: { height: 40, padding: "0 18px", fontSize: 14 },
    lg: { height: 52, padding: "0 26px", fontSize: 16 },
  };
  const v = {
    primary: { bg: "var(--pitch)", color: "#fff", hover: "var(--pitch-dark)" },
    secondary: { bg: "var(--surface)", color: "var(--ink)", border: "var(--line)", hover: "var(--surface-sunk)" },
    gold: { bg: "var(--gold)", color: "var(--pitch-deep)", hover: "var(--gold-dark)" },
    ghost: { bg: "transparent", color: "var(--ink-2)", hover: "var(--surface-sunk)" },
    danger: { bg: "var(--negative)", color: "#fff", hover: "#8a0019" },
  }[variant];
  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: block ? "flex" : "inline-flex", width: block ? "100%" : undefined,
        alignItems: "center", justifyContent: "center", gap: 8,
        fontFamily: "var(--font-body)", fontWeight: 600, letterSpacing: "-0.005em",
        border: `1px solid ${v.border || "transparent"}`, borderRadius: "var(--radius-pill)",
        cursor: isDisabled ? "not-allowed" : "pointer", whiteSpace: "nowrap", userSelect: "none",
        background: hover && !isDisabled ? v.hover : v.bg, color: v.color,
        transform: active && !isDisabled ? "scale(0.97)" : "none",
        opacity: isDisabled ? 0.5 : 1,
        transition: "background var(--dur-2) var(--ease-standard), transform var(--dur-1) var(--ease-standard)",
        ...sizes[size], ...extra,
      }}
    >
      {loading ? (
        <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
      ) : null}
      {children}
    </button>
  );
}

/* ------------------------------ Badge ------------------------------ */
const BADGE_TONES = {
  neutral: { solid: "var(--ink)", soft: "var(--surface-sunk)", text: "var(--ink-2)", tint: "var(--ink-3)" },
  live: { solid: "var(--live)", soft: "var(--live-tint)", text: "var(--live)", tint: "var(--live)" },
  gold: { solid: "var(--gold)", soft: "var(--gold-tint)", text: "var(--pitch-deep)", tint: "var(--gold-dark)" },
  positive: { solid: "var(--positive)", soft: "var(--positive-tint)", text: "var(--positive)", tint: "var(--positive)" },
  warning: { solid: "var(--warning)", soft: "var(--warning-tint)", text: "var(--warning)", tint: "var(--warning)" },
  negative: { solid: "var(--negative)", soft: "var(--negative-tint)", text: "var(--negative)", tint: "var(--negative)" },
  brand: { solid: "var(--pitch)", soft: "var(--pitch-tint)", text: "var(--pitch-dark)", tint: "var(--pitch)" },
};
function Badge({ tone = "neutral", variant = "soft", size = "md", children }) {
  const t = BADGE_TONES[tone];
  const sizes = { sm: { height: 20, padding: "0 8px", fontSize: 10 }, md: { height: 24, padding: "0 10px", fontSize: 11 } };
  const style = {
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: "var(--radius-pill)", fontFamily: "var(--font-body)",
    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
    ...sizes[size],
    ...(variant === "solid" ? { background: t.solid, color: tone === "gold" ? "var(--pitch-deep)" : "#fff" } :
        variant === "outline" ? { background: "transparent", color: t.text, border: `1px solid ${t.tint}` } :
        { background: t.soft, color: t.text }),
  };
  return (
    <span style={style}>
      {tone === "live" ? (
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", animation: "pulse 1.4s ease-out infinite" }} />
      ) : null}
      {children}
    </span>
  );
}

/* ------------------------------ Input ------------------------------ */
function Input({ value, onChange, placeholder, type = "text", prefix, suffix, size = "md", variant = "default", disabled, name, maxLength, required }) {
  const [focus, setFocus] = useState(false);
  const isPill = variant === "pill";
  const heights = { md: 44, lg: 52 };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "var(--surface)",
      border: `1px solid ${focus ? "var(--pitch)" : "var(--line)"}`,
      borderRadius: isPill ? "var(--radius-pill)" : "var(--radius-md)",
      padding: isPill ? "0 6px 0 18px" : "0 12px",
      height: heights[size],
      boxShadow: focus ? "0 0 0 3px rgba(11,107,58,0.15)" : "none",
      opacity: disabled ? 0.5 : 1,
      transition: "border-color var(--dur-2) var(--ease-standard), box-shadow var(--dur-2) var(--ease-standard)",
    }}>
      {prefix ? <span style={{ color: "var(--ink-3)", display: "flex" }}>{prefix}</span> : null}
      <input
        value={value} onChange={onChange} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        type={type} placeholder={placeholder} disabled={disabled} name={name} maxLength={maxLength} required={required}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)" }}
      />
      {suffix ? <span style={{ display: "flex" }}>{suffix}</span> : null}
    </div>
  );
}

/* ------------------------------ Tabs ------------------------------ */
function Tabs({ items, value, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 4, padding: 4,
      background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)",
      borderRadius: "var(--radius-pill)", border: "1px solid var(--line)",
      overflowX: "auto",
    }}>
      {items.map(([id, label]) => {
        const active = id === value;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            whiteSpace: "nowrap", padding: "8px 16px", borderRadius: "var(--radius-pill)",
            border: "none", cursor: "pointer",
            fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13,
            background: active ? "var(--pitch)" : "transparent",
            color: active ? "#fff" : "var(--ink-2)",
            transition: "background var(--dur-2) var(--ease-standard), color var(--dur-2) var(--ease-standard)",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

/* ------------------------------ GroupChip ------------------------------ */
const GROUP_COLOR = { A:"city-mexico-city", B:"city-vancouver", C:"city-atlanta", D:"city-houston", E:"city-philadelphia", F:"city-los-angeles", G:"city-guadalajara", H:"city-kansas-city", I:"city-monterrey", J:"city-san-francisco", K:"city-boston", L:"city-new-york-nj" };
function GroupChip({ group, size = "md" }) {
  const sizes = { sm: { s: 22, fs: 11 }, md: { s: 28, fs: 13 }, lg: { s: 40, fs: 18 } };
  const { s, fs } = sizes[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: s, height: s, borderRadius: "var(--radius-sm)",
      background: `var(--${GROUP_COLOR[group] || "pitch"})`, color: "#fff",
      fontFamily: "var(--font-display)", fontSize: fs, lineHeight: 1,
      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
    }}>{group}</span>
  );
}

/* ------------------------------ TeamRow ------------------------------ */
const TEAM_TO_ISO2_KIT = {
  MEX:"mx",RSA:"za",KOR:"kr",CZE:"cz",CAN:"ca",BIH:"ba",QAT:"qa",SUI:"ch",
  BRA:"br",MAR:"ma",HAI:"ht",SCO:"gb-sct",USA:"us",PAR:"py",AUS:"au",TUR:"tr",
  GER:"de",CUW:"cw",CIV:"ci",ECU:"ec",NED:"nl",JPN:"jp",SWE:"se",TUN:"tn",
  BEL:"be",EGY:"eg",IRN:"ir",NZL:"nz",ESP:"es",CPV:"cv",KSA:"sa",URU:"uy",
  FRA:"fr",SEN:"sn",IRQ:"iq",NOR:"no",ARG:"ar",ALG:"dz",AUT:"at",JOR:"jo",
  POR:"pt",COD:"cd",UZB:"uz",COL:"co",ENG:"gb-eng",CRO:"hr",GHA:"gh",PAN:"pa",
};
function MiniFlag({ code, size = 18 }) {
  const iso2 = TEAM_TO_ISO2_KIT[code];
  if (!iso2) return null;
  return (
    <img src={`https://flagcdn.com/${iso2}.svg`} alt={code} width={size} height={Math.round(size * 0.75)} loading="lazy"
      style={{ display: "inline-block", width: size, height: Math.round(size * 0.75),
               borderRadius: 3, overflow: "hidden", background: "var(--surface-sunk)",
               boxShadow: "inset 0 0 0 1px rgba(10,15,13,0.08)", objectFit: "cover", flexShrink: 0 }} />
  );
}
function TeamRow({ name, code, score, isWinner, isLoser, flag, onPick, pickable, picked }) {
  const [hover, setHover] = useState(false);
  const dimmed = isLoser && !isWinner;
  const iso2 = code && TEAM_TO_ISO2_KIT[code];
  return (
    <div role={pickable ? "button" : undefined} tabIndex={pickable ? 0 : undefined}
      onClick={onPick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        minHeight: pickable ? 44 : 32, padding: pickable ? "8px 12px" : "4px 0",
        borderRadius: pickable ? "var(--radius-md)" : 0,
        background: picked ? "var(--pitch-tint)" : (hover && pickable ? "var(--surface-sunk)" : "transparent"),
        border: pickable ? `2px solid ${picked ? "var(--pitch)" : "transparent"}` : "none",
        cursor: pickable ? "pointer" : "default",
        color: dimmed ? "var(--ink-4)" : "var(--ink)",
        transition: "background var(--dur-2) var(--ease-standard), border-color var(--dur-2) var(--ease-standard)",
      }}>
      {iso2 ? <MiniFlag code={code} size={20} />
       : flag ? <span style={{ fontSize: 18, lineHeight: 1 }}>{flag}</span> : null}
      <span style={{ fontWeight: isWinner ? 700 : 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
        {code ? <span style={{ marginLeft: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: dimmed ? "var(--ink-4)" : "var(--ink-3)" }}>{code}</span> : null}
      </span>
      {picked ? <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--pitch)", letterSpacing: "0.08em" }}>PICKED</span> : null}
      {score != null ? <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 16, minWidth: 18, textAlign: "right" }}>{score}</span> : null}
    </div>
  );
}

/* ------------------------------ MatchCard ------------------------------ */
function MatchCard({ matchNo, round, kickoff, status = "upcoming", minute, accent, home, away, winnerCode, pickedCode, pointsEarned }) {
  const decided = status === "final";
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderLeft: accent ? `4px solid var(--${accent})` : "1px solid var(--line)",
      borderRadius: "var(--radius-md)", padding: "10px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
          <span style={{ fontWeight: 700 }}>M{matchNo}</span>
          {round ? <span>· {round}</span> : null}
          {kickoff ? <span>· {kickoff}</span> : null}
        </div>
        {status === "live" ? <Badge tone="live" variant="soft" size="sm">{minute ? `${minute}'` : "Live"}</Badge>
         : status === "final" ? <Badge tone="neutral" variant="soft" size="sm">Final</Badge> : null}
      </div>
      <TeamRow {...home} isWinner={decided && winnerCode === home.code} isLoser={decided && winnerCode === away.code} />
      <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
      <TeamRow {...away} isWinner={decided && winnerCode === away.code} isLoser={decided && winnerCode === home.code} />
      {(pickedCode || pointsEarned != null) ? (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--line)", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)" }}>
          {pickedCode ? <span>Your pick · <strong style={{ color: "var(--ink)" }}>{pickedCode}</strong></span> : <span />}
          {pointsEarned != null ? <Badge tone={pointsEarned > 0 ? "positive" : "neutral"} variant="soft" size="sm">{pointsEarned > 0 ? `+${pointsEarned} pts` : "0 pts"}</Badge> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ LeaderboardRow ------------------------------ */
function LeaderboardRow({ rank, label, total, projected, isLeader, isYou, breakdown = [], initials, avatarColor = "pitch" }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${isLeader ? "var(--gold)" : "var(--line)"}`,
      boxShadow: isLeader ? "var(--shadow-ring-gold)" : "var(--shadow-xs)",
      borderRadius: "var(--radius-lg)", padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 32, textAlign: "center", fontFamily: "var(--font-display)", fontSize: medal ? 22 : 18, color: medal ? undefined : "var(--ink-3)" }}>{medal ?? rank}</span>
        <span style={{ width: 32, height: 32, borderRadius: "var(--radius-pill)", background: `var(--${avatarColor})`, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 13, textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{initials || label.slice(0, 2).toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>
          {label}
          {isYou ? <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: "var(--radius-pill)", background: "var(--pitch-tint)", color: "var(--pitch-dark)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>YOU</span> : null}
        </span>
        <span style={{ textAlign: "right" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{total}</span>
          <span style={{ marginLeft: 4, fontSize: 11, color: "var(--ink-3)" }}>pts</span>
          {projected != null && projected !== 0 ? <span style={{ display: "block", marginTop: 2, fontSize: 11, color: projected > 0 ? "var(--positive)" : "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{projected > 0 ? `▲ ${projected} live` : `· ${projected} live`}</span> : null}
        </span>
      </div>
      {breakdown.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 76 }}>
          {breakdown.filter(b => b.value > 0).map(b => (
            <span key={b.label} style={{ background: "var(--pitch-tint)", color: "var(--pitch-dark)", borderRadius: "var(--radius-pill)", padding: "2px 8px", fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{b.label} {b.value}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ PoolHero ------------------------------ */
function PoolHero({ eyebrow, title, subtitle, metric, pattern, patternSrc, status, actions }) {
  const STATUS = { upcoming: { tone: "gold", label: "Upcoming" }, live: { tone: "live", label: "Live" }, final: { tone: "neutral", label: "Final" } };
  const s = status ? STATUS[status] : null;
  return (
    <div style={{
      position: "relative", background: "var(--pitch)", color: "#fff",
      borderRadius: "var(--radius-2xl)", padding: "24px 22px", overflow: "hidden",
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
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{
            flex: 1, minWidth: 0,
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "var(--radius-lg)",
            padding: "12px 14px",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}>
            {eyebrow ? <div style={{ color: "var(--gold)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{eyebrow}</div> : null}
            <h1 style={{ margin: "4px 0 0 0", fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.05, wordBreak: "break-word", textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>{title}</h1>
            {subtitle ? <p style={{ margin: "8px 0 0 0", fontSize: 13, lineHeight: 1.4, color: "rgba(255,255,255,0.9)" }}>{subtitle}</p> : null}
          </div>
          {s ? <Badge tone={s.tone} variant="solid" size="md">{s.label}</Badge> : null}
        </div>
        {metric ? (
          <div style={{ marginTop: 14, display: "inline-flex", flexDirection: "column", background: "rgba(0,0,0,0.40)", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.78)" }}>{metric.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, letterSpacing: "0.1em" }}>{metric.value}</span>
          </div>
        ) : null}
        {actions ? <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------ PickSelector ------------------------------ */
function PickOption({ opt, picked, onPick }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const iso2 = TEAM_TO_ISO2_KIT[opt.code];
  return (
    <button onClick={() => onPick(opt.code)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}
      style={{
        flex: 1, minWidth: 0, minHeight: 44, padding: "14px 12px",
        background: picked ? "var(--pitch)" : (hover ? "var(--pitch-tint)" : "var(--surface)"),
        color: picked ? "#fff" : "var(--ink)",
        border: `2px solid ${picked ? "var(--pitch)" : "var(--line)"}`,
        borderRadius: "var(--radius-lg)", cursor: "pointer",
        transform: active ? "scale(0.97)" : "scale(1)",
        transition: "all var(--dur-2) var(--ease-standard)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
      {iso2 ? (
        <img src={`https://flagcdn.com/${iso2}.svg`} alt={opt.code} width={48} height={36} loading="lazy"
          style={{ borderRadius: 6, objectFit: "cover", boxShadow: "inset 0 0 0 1px rgba(10,15,13,0.10)" }} />
      ) : opt.flag ? <span style={{ fontSize: 28, lineHeight: 1 }}>{opt.flag}</span> : null}
      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: "0.02em" }}>{opt.code}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: picked ? "rgba(255,255,255,0.85)" : "var(--ink-3)" }}>{opt.name}</span>
    </button>
  );
}
function PickSelector({ title, kickoff, caption, options, value, onPick }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 14 }}>
      {caption ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>{caption}</div> : null}
      {title ? <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{title}</div> : null}
      {kickoff ? <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{kickoff}</div> : null}
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "stretch" }}>
        <PickOption opt={options[0]} picked={value === options[0].code} onPick={onPick} />
        <div style={{ alignSelf: "center", fontFamily: "var(--font-display)", fontSize: 12, color: "var(--ink-3)" }}>vs</div>
        <PickOption opt={options[1]} picked={value === options[1].code} onPick={onPick} />
      </div>
    </div>
  );
}

/* ------------------------------ ChatBubble ------------------------------ */
function ChatBubble({ body, authorName, timestamp, mine, authorColor }) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "80%",
        background: mine ? "var(--pitch)" : "var(--surface-sunk)",
        color: mine ? "#fff" : "var(--ink)",
        borderRadius: 16, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4,
        padding: "8px 12px", fontSize: 14, lineHeight: 1.4,
      }}>
        {!mine && authorName ? <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.04em", color: authorColor ? `var(--${authorColor})` : "var(--pitch-dark)", marginBottom: 2 }}>{authorName}</div> : null}
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{body}</div>
        {time ? <div style={{ marginTop: 4, fontSize: 10, color: mine ? "rgba(255,255,255,0.6)" : "var(--ink-3)", textAlign: "right" }}>{time}</div> : null}
      </div>
    </div>
  );
}

window.DS = { Button, Badge, Input, Tabs, GroupChip, TeamRow, MatchCard, LeaderboardRow, PoolHero, PickSelector, ChatBubble };
