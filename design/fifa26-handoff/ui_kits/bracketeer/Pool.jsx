/* Pool screen — the main /pool/[code] view. Hero + sticky tabs + sections. */

function Pool({ poolCode = "FIXTUR", onMakePick, onSignOut, onOpenDesktop }) {
  const { PoolHero, Tabs, LeaderboardRow, MatchCard, ChatBubble, Input, Button, GroupChip, Badge } = window.DS;
  const { SAMPLE_LEADERBOARD, SAMPLE_MATCHES, SAMPLE_GROUPS, SAMPLE_THIRDS, SAMPLE_MESSAGES } = window.DATA;
  const [tab, setTab] = React.useState("leaderboard");
  const [msg, setMsg] = React.useState("");

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 32px", fontFamily: "var(--font-body)" }}>
      <PoolHero
        eyebrow="FIFA World Cup 2026"
        title="Dom's pool"
        subtitle="48 teams · 104 matches · 12 entries"
        status="live"
        pattern
        metric={{ label: "Join code", value: poolCode }}
        actions={<>
          <Button variant="gold" onClick={onMakePick}>Make a pick</Button>
          <Button variant="ghost" onClick={onOpenDesktop} style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", color: "#fff", border: "1px solid rgba(255,255,255,0.28)" }}>Full bracket →</Button>
          <Button variant="ghost" onClick={onSignOut} style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", color: "#fff", border: "1px solid rgba(255,255,255,0.28)" }}>Sign out</Button>
        </>}
      />

      <div style={{ position: "sticky", top: 8, zIndex: 10, marginTop: 14 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[["leaderboard","Leaderboard"],["bracket","Live & next"],["groups","Groups"],["chat","Chat"]]}
        />
      </div>

      {tab === "leaderboard" ? (
        <section style={{ marginTop: 20, display: "grid", gap: 10 }}>
          <SectionLabel>Standings</SectionLabel>
          {SAMPLE_LEADERBOARD.map((row) => (
            <LeaderboardRow key={row.entryId} {...row} />
          ))}
        </section>
      ) : null}

      {tab === "bracket" ? (
        <section style={{ marginTop: 20, display: "grid", gap: 14 }}>
          <div>
            <SectionLabel>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                Live · Round of 32 <Badge tone="live" size="sm" variant="solid">2 live</Badge>
              </span>
            </SectionLabel>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {SAMPLE_MATCHES.live.map((m) => (
                <MatchCard
                  key={m.matchNo}
                  matchNo={m.matchNo}
                  round={m.round} kickoff={m.kickoff} status={m.status} minute={m.minute} accent={m.accent}
                  home={{ ...m.home, score: m.home_score }}
                  away={{ ...m.away, score: m.away_score }}
                  winnerCode={m.winnerCode} pickedCode={m.pickedCode} pointsEarned={m.pointsEarned}
                />
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Final · Round of 16</SectionLabel>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {SAMPLE_MATCHES.final.map((m) => (
                <MatchCard
                  key={m.matchNo}
                  matchNo={m.matchNo}
                  round={m.round} kickoff={m.kickoff} status={m.status} accent={m.accent}
                  home={{ ...m.home, score: m.home_score }}
                  away={{ ...m.away, score: m.away_score }}
                  winnerCode={m.winnerCode} pickedCode={m.pickedCode} pointsEarned={m.pointsEarned}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "groups" ? (
        <section style={{ marginTop: 20 }}>
          <SectionLabel>Group standings</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {SAMPLE_GROUPS.map((g) => (
              <div key={g.group} style={{
                background: "var(--surface)", border: "1px solid var(--line)",
                borderRadius: "var(--radius-md)", padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GroupChip group={g.group} size="sm" />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Group {g.group}</span>
                </div>
                <div style={{ fontSize: 13 }}><span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>1.</span> <strong style={{ color: "var(--ink)" }}>{g.first}</strong></div>
                <div style={{ fontSize: 13 }}><span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>2.</span> {g.second}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 12, background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)", padding: "12px 14px",
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
              Third-place advancers
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)" }}>
              {SAMPLE_THIRDS.join(" · ")}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "chat" ? (
        <section style={{ marginTop: 20 }}>
          <SectionLabel>Pool chat</SectionLabel>
          <div style={{
            marginTop: 8, background: "var(--surface)", border: "1px solid var(--line)",
            borderRadius: "var(--radius-2xl)", overflow: "hidden",
          }}>
            <div style={{ display: "grid", gap: 8, padding: 16, maxHeight: 320, overflowY: "auto" }}>
              {SAMPLE_MESSAGES.map((m) => (
                <ChatBubble key={m.id} body={m.body} authorName={m.authorName} authorColor={m.authorColor} timestamp={m.createdAt} mine={m.mine} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
              <div style={{ flex: 1 }}>
                <Input
                  variant="pill"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Message your pool…"
                  suffix={<Button size="sm" onClick={() => setMsg("")} disabled={!msg.trim()}>Send</Button>}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function SectionLabel({ children }) {
  return (
    <h2 style={{
      margin: 0, padding: "0 2px",
      fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 11,
      color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase",
    }}>{children}</h2>
  );
}

window.Pool = Pool;
