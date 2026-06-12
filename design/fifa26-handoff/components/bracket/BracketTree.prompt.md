A desktop-only horizontal tree of the full knockout stage — Round of 32 → Round of 16 → Quarter-finals → Semi-finals → Final, with optional Third-place card. Each round column gets its own host-city accent (philadelphia → LA → guadalajara → houston → gold) so the eye reads the sweep from left to right.

```jsx
<BracketTree
  rounds={{
    r32: [...16 matches],
    r16: [...8],
    qf:  [...4],
    sf:  [...2],
    final: [...1],
  }}
  bronze={{...}}
/>
```

Approx footprint: **1224 × 1100 px** at defaults — meant for ≥1280px viewports. Below that, fall back to the round-by-round vertical list (`MatchCard` in a single column).
