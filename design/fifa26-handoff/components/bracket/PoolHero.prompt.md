The pitch-green hero panel sitting at the top of every pool view. Optional `pattern` paints the official FIFA 26 background image behind the gradient scrim.

```jsx
<PoolHero
  eyebrow="FIFA World Cup 2026"
  title="Dom's pool"
  subtitle="48 teams · 104 matches · 12 entries"
  status="live"
  pattern
  metric={{ label: "Join code", value: "FIXTUR" }}
  actions={<>
    <Button variant="gold" size="md">Make a pick</Button>
    <Button variant="ghost" size="md">Share invite</Button>
  </>}
/>
```
