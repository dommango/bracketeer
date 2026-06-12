import React from "react";

const ORDER = ["r32", "r16", "qf", "sf", "final"];
const LABEL = { r32: "Round of 32", r16: "Round of 16", qf: "Quarter-finals", sf: "Semi-finals", final: "Final" };
const ACCENT = { r32: "city-philadelphia", r16: "city-los-angeles", qf: "city-guadalajara", sf: "city-houston", final: "gold" };

function TinyCard({ m, accent, w, h }) {
  const decided = m.status === "final";
  const liveOrFinal = m.status === "live" || decided;
  const homeWin = decided && m.winnerCode === m.home?.code;
  const awayWin = decided && m.winnerCode === m.away?.code;

  const sideStyle = (isWin, isLoss) => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "0 8px",
    height: (h - 18) / 2,
    fontSize: 12,
    fontWeight: isWin ? 700 : 500,
    color: isLoss ? "var(--ink-4)" : "var(--ink)",
  });

  return (
    <div style={{
      width: w, height: h,
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderLeft: `3px solid var(--${accent})`,
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      boxShadow: "var(--shadow-xs)",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--font-body)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 8px", height: 18,
        background: "var(--surface-sunk)",
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)",
        borderBottom: "1px solid var(--line)",
      }}>
        <span style={{ fontWeight: 700 }}>M{m.matchNo}</span>
        {m.status === "live" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--live)", fontWeight: 700 }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor" }} />
            {m.minute ? `${m.minute}'` : "Live"}
          </span>
        ) : decided ? <span>Final</span> : m.kickoff ? <span>{m.kickoff}</span> : null}
      </div>
      <div style={sideStyle(homeWin, awayWin)}>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {m.home?.name || "—"}
          {m.home?.code ? <span style={{ marginLeft: 4, color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 9 }}>{m.home.code}</span> : null}
        </span>
        {liveOrFinal && m.homeScore != null ? (
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{m.homeScore}</span>
        ) : null}
      </div>
      <div style={{ height: 1, background: "var(--line-soft)" }} />
      <div style={sideStyle(awayWin, homeWin)}>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {m.away?.name || "—"}
          {m.away?.code ? <span style={{ marginLeft: 4, color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 9 }}>{m.away.code}</span> : null}
        </span>
        {liveOrFinal && m.awayScore != null ? (
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{m.awayScore}</span>
        ) : null}
      </div>
    </div>
  );
}

export function BracketTree({
  rounds, bronze,
  cardWidth = 200, cardHeight = 64,
  pad = 24, colWidth = 240,
}) {
  const headerH = 36;
  const rowsR32 = 16;
  const treeH = rowsR32 * cardHeight + (rowsR32 - 1) * 6; // tight pairs
  const totalH = treeH + pad * 2 + headerH + (bronze ? cardHeight + 60 : 0);
  const totalW = colWidth * 5 + 24;

  // y-center of match `mi` in round index `ri` (0 = R32)
  const slotH = (treeH) / (rowsR32 / 1); // = cardHeight + gap basically
  function centerY(ri, mi) {
    const matchesInRound = rowsR32 / Math.pow(2, ri);
    const span = treeH / matchesInRound;
    return pad + headerH + mi * span + span / 2;
  }
  function colLeft(ri) {
    return ri * colWidth + 12;
  }

  // Build connector paths
  const connectors = [];
  for (let ri = 0; ri < ORDER.length - 1; ri++) {
    const matchesInRound = rowsR32 / Math.pow(2, ri);
    for (let mi = 0; mi < matchesInRound; mi++) {
      const parentMi = Math.floor(mi / 2);
      const fromX = colLeft(ri) + cardWidth;
      const fromY = centerY(ri, mi);
      const toX = colLeft(ri + 1);
      const toY = centerY(ri + 1, parentMi);
      const midX = (fromX + toX) / 2;
      connectors.push(`M${fromX},${fromY} H${midX} V${toY} H${toX}`);
    }
  }

  return (
    <div style={{
      position: "relative",
      width: totalW, height: totalH,
      fontFamily: "var(--font-body)",
      background: "var(--paper)",
    }}>
      {/* Round headers */}
      {ORDER.map((round, ri) => (
        <div key={`h-${round}`} style={{
          position: "absolute",
          top: pad,
          left: colLeft(ri),
          width: cardWidth,
          height: headerH - 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: "var(--radius-xs)",
            background: `var(--${ACCENT[round]})`,
          }} />
          <span style={{
            fontFamily: "var(--font-display)", fontSize: 11,
            textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--ink-2)",
          }}>{LABEL[round]}</span>
        </div>
      ))}

      {/* Connectors */}
      <svg
        style={{ position: "absolute", inset: 0, width: totalW, height: totalH, pointerEvents: "none" }}
        viewBox={`0 0 ${totalW} ${totalH}`}
      >
        {connectors.map((d, i) => (
          <path key={i} d={d} stroke="var(--line)" strokeWidth="1.5" fill="none" />
        ))}
      </svg>

      {/* Cards */}
      {ORDER.map((round, ri) => (
        (rounds[round] || []).map((m, mi) => (
          <div key={`c-${round}-${mi}`} style={{
            position: "absolute",
            left: colLeft(ri),
            top: centerY(ri, mi) - cardHeight / 2,
          }}>
            <TinyCard m={m} accent={ACCENT[round]} w={cardWidth} h={cardHeight} />
          </div>
        ))
      ))}

      {/* Bronze (3rd place) */}
      {bronze ? (
        <div style={{
          position: "absolute",
          left: colLeft(4),
          top: pad + headerH + treeH + 24,
          width: cardWidth,
        }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 10,
            textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--ink-3)", marginBottom: 6,
          }}>Third place</div>
          <TinyCard m={bronze} accent="ink-3" w={cardWidth} h={cardHeight} />
        </div>
      ) : null}
    </div>
  );
}
