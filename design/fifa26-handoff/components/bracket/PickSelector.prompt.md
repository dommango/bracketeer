The single-tap winner selector — the most-tapped surface in the whole app. Two side-by-side cards, no dropdown. Tapping either one calls `onPick(code)` and snaps the pitch-green selection state in <140ms.

```jsx
<PickSelector
  caption="Round of 32 · M73"
  title="Who wins?"
  kickoff="Sat Jun 27 · 15:00 ET"
  value={pick}
  onPick={setPick}
  options={[
    { code: "BRA", name: "Brazil", flag: "🇧🇷" },
    { code: "ARG", name: "Argentina", flag: "🇦🇷" },
  ]}
/>
```
