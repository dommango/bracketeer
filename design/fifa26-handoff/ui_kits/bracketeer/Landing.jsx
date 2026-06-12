/* Landing screen — mirrors bracketeer/app/page.tsx layout: green hero card +
   "have a join code" panel + CTA. */

function Landing({ onOpenPool }) {
  const { Button, Input } = window.DS;
  const [code, setCode] = React.useState("");
  return (
    <main style={{
      maxWidth: 480, margin: "0 auto",
      padding: "48px 20px 24px",
      fontFamily: "var(--font-body)",
    }}>
      {/* hero */}
      <div style={{
        position: "relative",
        background: "var(--pitch)",
        color: "#fff",
        borderRadius: "var(--radius-3xl)",
        padding: "32px 26px",
        overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url(../../assets/brand-26-pattern.avif)",
          backgroundSize: "cover", backgroundPosition: "center",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{
            display: "inline-block",
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "var(--radius-xl)",
            padding: "16px 18px",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
            maxWidth: "100%",
          }}>
            <span style={{
              display: "inline-block",
              color: "var(--gold)", fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>HessFest</span>
            <h1 style={{
              margin: "10px 0 0 0",
              fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.02,
              wordBreak: "break-word",
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}>Run a World Cup 2026 pool with your friends.</h1>
            <p style={{ margin: "12px 0 0 0", fontSize: 14, color: "rgba(255,255,255,0.88)" }}>
              Live scores, a realtime leaderboard, and group chat — all in one place.
            </p>
          </div>
          <div style={{
            display: "flex", gap: 8, marginTop: 16,
            color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.08em",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}>
            <span>48 teams</span><span>·</span><span>104 matches</span><span>·</span><span>June 11</span>
          </div>
        </div>
      </div>

      {/* join code */}
      <div style={{
        marginTop: 24,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-2xl)",
        padding: "22px 22px",
      }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)" }}>Have a join code?</h2>
        <p style={{ margin: "6px 0 16px 0", fontSize: 13, color: "var(--ink-3)" }}>
          Enter the 6-letter code your pool admin shared with you.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="FIXTUR"
            prefix={<span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--ink-3)" }}>#</span>}
          />
          <Button variant="primary" onClick={() => onOpenPool(code || "FIXTUR")}>Open</Button>
        </div>
        <button
          onClick={() => onOpenPool("FIXTUR")}
          style={{
            marginTop: 14, width: "100%",
            background: "transparent", border: "none", padding: "10px",
            color: "var(--pitch-dark)", fontWeight: 600, fontSize: 13,
            cursor: "pointer", borderRadius: "var(--radius-pill)",
            fontFamily: "var(--font-body)",
          }}
        >View the demo pool →</button>
      </div>

      <div style={{
        marginTop: 28, display: "flex", justifyContent: "center", gap: 8,
        fontSize: 11, color: "var(--ink-3)",
      }}>
        <span>FIFA World Cup 26™</span>
        <span>·</span>
        <span>Pool MVP · Kickoff Jun 11, 2026</span>
      </div>
    </main>
  );
}

window.Landing = Landing;
