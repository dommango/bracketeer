/* Desktop bracket screen — full 5-round knockout tree on a paper background,
   subtle host-city pattern behind the round labels. */

function Desktop({ onBack }) {
  const { BracketTree, Button, Badge, Flag } = window.DS;
  const { SAMPLE_TREE } = window.DATA;

  return (
    <main style={{
      minHeight: "100vh", background: "var(--paper)",
      fontFamily: "var(--font-body)", color: "var(--ink)",
      padding: "20px 24px 40px",
    }}>
      {/* Header strip */}
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <Button variant="ghost" size="md" onClick={onBack}>← Back to pool</Button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)" }}>Dom's pool — full bracket</div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Knockout stage · 31 matches across 5 rounds</div>
        </div>
        <Badge tone="live" variant="soft" size="md">2 live</Badge>
        <Badge tone="brand" variant="outline" size="md">12 entries</Badge>
      </div>

      {/* Subtle host-city pattern banner over the tree */}
      <div style={{
        position: "relative",
        maxWidth: 1280, margin: "0 auto",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-2xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-md)",
      }}>
        <div style={{
          position: "relative",
          padding: "20px 32px",
          background: "var(--pitch)",
          color: "#fff",
          overflow: "hidden",
        }}>
          <div className="pattern" data-pattern="philadelphia" style={{ color: "#fff", "--pattern-opacity": 0.08 }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)" }}>FIFA 26 · Knockouts</span>
            <span style={{ flex: 1 }} />
            <RoundLegend />
          </div>
        </div>

        <div style={{ overflowX: "auto", padding: "8px 0 0" }}>
          <div style={{ minWidth: 1244 }}>
            <BracketTree rounds={SAMPLE_TREE.rounds} bronze={SAMPLE_TREE.bronze} />
          </div>
        </div>
      </div>
    </main>
  );
}

function RoundLegend() {
  const items = [
    ["philadelphia", "R32"],
    ["los-angeles",  "R16"],
    ["guadalajara",  "QF"],
    ["houston",      "SF"],
    ["gold",         "Final"],
  ];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {items.map(([c, l]) => (
        <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.85)" }}>
          <span style={{
            width: 10, height: 10, borderRadius: 3,
            background: c === "gold" ? "var(--gold)" : `var(--city-${c})`,
          }} />
          {l}
        </span>
      ))}
    </div>
  );
}

window.Desktop = Desktop;
