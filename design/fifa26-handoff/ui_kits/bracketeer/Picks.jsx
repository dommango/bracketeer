/* Picks wizard — single-tap selection, round-by-round paging, autosave. */

function Picks({ onClose }) {
  const { PickSelector, Button, GroupChip, Badge } = window.DS;
  const { PICK_QUEUE } = window.DATA;
  const [idx, setIdx] = React.useState(0);
  const [picks, setPicks] = React.useState({});
  const [savedAt, setSavedAt] = React.useState(Date.now());

  const total = PICK_QUEUE.length;
  const match = PICK_QUEUE[idx];
  const done = Object.keys(picks).length;
  const pct = (done / total) * 100;

  function pick(code) {
    const next = { ...picks, [match.matchNo]: code };
    setPicks(next);
    setSavedAt(Date.now()); // simulate autosave on every tap
    // brief delay then auto-advance — mirrors the wizard's "no friction" rule
    if (idx < total - 1) {
      setTimeout(() => setIdx(idx + 1), 220);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--paper)", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)", zIndex: 100 }}>
      {/* top bar */}
      <div style={{
        padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", cursor: "pointer",
          width: 36, height: 36, borderRadius: "var(--radius-pill)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink-2)", fontSize: 22,
        }}>×</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink)" }}>Group stage picks</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
            <span style={{ color: "var(--positive)", fontWeight: 600 }}>● Autosaved</span>
            {"   "}{done} of {total}
          </div>
        </div>
        <Badge tone="warning" variant="soft" size="sm">Kickoff 36h</Badge>
      </div>

      {/* progress */}
      <div style={{ height: 4, background: "var(--surface-sunk)" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: "var(--pitch)",
          transition: "width var(--dur-3) var(--ease-standard)",
        }} />
      </div>

      {/* current match — placed in the upper third so thumb action lives in the lower 2/3 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 24px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <GroupChip group={match.group} size="md" />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--ink-2)", letterSpacing: "0.04em" }}>
              Group {match.group}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
              M{match.matchNo} · {idx + 1}/{total}
            </span>
          </div>

          <PickSelector
            caption={match.kickoff}
            title={`Who wins ${match.home.name} vs ${match.away.name}?`}
            value={picks[match.matchNo]}
            onPick={pick}
            options={[match.home, match.away]}
          />

          {/* mini-history rail so the user sees their last few picks */}
          {idx > 0 ? (
            <div style={{ marginTop: 20 }}>
              <div style={{
                fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 11,
                color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
              }}>Recent picks</div>
              <div style={{ display: "grid", gap: 6 }}>
                {PICK_QUEUE.slice(Math.max(0, idx - 3), idx).map((m) => (
                  <div key={m.matchNo} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "var(--surface)", border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)", padding: "8px 12px",
                    fontSize: 13,
                  }}>
                    <GroupChip group={m.group} size="sm" />
                    <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>M{m.matchNo}</span>
                    <span style={{ flex: 1, color: "var(--ink-2)" }}>
                      {m.home.name} vs {m.away.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", color: "var(--pitch)", fontSize: 12 }}>
                      {picks[m.matchNo] || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* footer — controls in the thumb zone */}
      <div style={{
        padding: "12px 18px 18px",
        borderTop: "1px solid var(--line)",
        background: "var(--surface)",
        display: "flex", gap: 10, alignItems: "center",
      }}>
        <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(Math.max(0, idx - 1))}>← Back</Button>
        <div style={{ flex: 1 }} />
        {idx < total - 1 ? (
          <Button variant="primary" onClick={() => setIdx(idx + 1)}>Skip →</Button>
        ) : (
          <Button variant="gold" onClick={onClose}>Lock in {done} picks</Button>
        )}
      </div>
    </div>
  );
}

window.Picks = Picks;
