/* Inline copy of BracketTree + Flag for the UI kit (mirrors the canonical
   components in components/bracket/). Exposed on window.DS. */

(function () {
  const TEAM_TO_ISO2 = {
    MEX:"mx",RSA:"za",KOR:"kr",CZE:"cz",CAN:"ca",BIH:"ba",QAT:"qa",SUI:"ch",
    BRA:"br",MAR:"ma",HAI:"ht",SCO:"gb-sct",USA:"us",PAR:"py",AUS:"au",TUR:"tr",
    GER:"de",CUW:"cw",CIV:"ci",ECU:"ec",NED:"nl",JPN:"jp",SWE:"se",TUN:"tn",
    BEL:"be",EGY:"eg",IRN:"ir",NZL:"nz",ESP:"es",CPV:"cv",KSA:"sa",URU:"uy",
    FRA:"fr",SEN:"sn",IRQ:"iq",NOR:"no",ARG:"ar",ALG:"dz",AUT:"at",JOR:"jo",
    POR:"pt",COD:"cd",UZB:"uz",COL:"co",ENG:"gb-eng",CRO:"hr",GHA:"gh",PAN:"pa",
  };

  function Flag({ code, size = 24, shape = "square", bordered = false }) {
    const iso2 = TEAM_TO_ISO2[code] || "un";
    const h = shape === "rect" ? Math.round(size * 0.75) : size;
    return (
      <img
        src={`https://flagcdn.com/${iso2}.svg`}
        alt={code}
        width={size}
        height={h}
        loading="lazy"
        style={{
          display: "inline-block",
          width: size, height: h,
          borderRadius: shape === "circle" ? "50%" : shape === "rect" ? 3 : 4,
          overflow: "hidden",
          background: "var(--surface-sunk)",
          boxShadow: bordered ? "inset 0 0 0 1px rgba(10,15,13,0.10)" : "none",
          objectFit: "cover", flexShrink: 0, verticalAlign: "middle",
        }}
      />
    );
  }

  const ORDER = ["r32", "r16", "qf", "sf", "final"];
  const LABEL = { r32: "Round of 32", r16: "Round of 16", qf: "Quarter-finals", sf: "Semi-finals", final: "Final" };
  const ACCENT = { r32: "city-philadelphia", r16: "city-los-angeles", qf: "city-guadalajara", sf: "city-houston", final: "gold" };

  function TinyCard({ m, accent, w, h }) {
    const decided = m.status === "final";
    const liveOrFinal = m.status === "live" || decided;
    const homeWin = decided && m.winnerCode === m.home?.code;
    const awayWin = decided && m.winnerCode === m.away?.code;
    const side = (isWin, isLoss) => ({
      display: "flex", alignItems: "center", gap: 6,
      padding: "0 8px", height: (h - 18) / 2,
      fontSize: 12, fontWeight: isWin ? 700 : 500,
      color: isLoss ? "var(--ink-4)" : "var(--ink)",
    });
    const realFlag = (code) => code && TEAM_TO_ISO2[code];
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
          padding: "0 8px", height: 18, background: "var(--surface-sunk)",
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
        <div style={side(homeWin, awayWin)}>
          {realFlag(m.home?.code) ? <Flag code={m.home.code} size={14} shape="rect" bordered /> : null}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.home?.name || "—"}
          </span>
          {liveOrFinal && m.homeScore != null ? <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{m.homeScore}</span> : null}
        </div>
        <div style={{ height: 1, background: "var(--line-soft)" }} />
        <div style={side(awayWin, homeWin)}>
          {realFlag(m.away?.code) ? <Flag code={m.away.code} size={14} shape="rect" bordered /> : null}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {m.away?.name || "—"}
          </span>
          {liveOrFinal && m.awayScore != null ? <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{m.awayScore}</span> : null}
        </div>
      </div>
    );
  }

  function BracketTree({ rounds, bronze, cardWidth = 200, cardHeight = 64, pad = 24, colWidth = 240 }) {
    const headerH = 36;
    const rowsR32 = 16;
    const treeH = rowsR32 * cardHeight + (rowsR32 - 1) * 6;
    const totalH = treeH + pad * 2 + headerH + (bronze ? cardHeight + 60 : 0);
    const totalW = colWidth * 5 + 24;

    const centerY = (ri, mi) => {
      const matchesInRound = rowsR32 / Math.pow(2, ri);
      const span = treeH / matchesInRound;
      return pad + headerH + mi * span + span / 2;
    };
    const colLeft = (ri) => ri * colWidth + 12;

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
        position: "relative", width: totalW, height: totalH,
        fontFamily: "var(--font-body)", background: "var(--paper)",
      }}>
        {ORDER.map((round, ri) => (
          <div key={`h-${round}`} style={{
            position: "absolute", top: pad, left: colLeft(ri),
            width: cardWidth, height: headerH - 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "var(--radius-xs)", background: `var(--${ACCENT[round]})` }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-2)" }}>{LABEL[round]}</span>
          </div>
        ))}
        <svg style={{ position: "absolute", inset: 0, width: totalW, height: totalH, pointerEvents: "none" }} viewBox={`0 0 ${totalW} ${totalH}`}>
          {connectors.map((d, i) => <path key={i} d={d} stroke="var(--line)" strokeWidth="1.5" fill="none" />)}
        </svg>
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
        {bronze ? (
          <div style={{ position: "absolute", left: colLeft(4), top: pad + headerH + treeH + 24, width: cardWidth }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-3)", marginBottom: 6 }}>Third place</div>
            <TinyCard m={bronze} accent="ink-3" w={cardWidth} h={cardHeight} />
          </div>
        ) : null}
      </div>
    );
  }

  window.DS = Object.assign(window.DS || {}, { Flag, BracketTree, TEAM_TO_ISO2 });
})();
