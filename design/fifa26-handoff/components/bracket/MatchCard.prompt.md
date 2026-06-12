A single match panel — used in the bracket, group standings, and the pick flow. Keeps M-number + round + kickoff at the top, two TeamRows stacked, and a live/final pill on the right.

```jsx
<MatchCard
  matchNo={73}
  round="Round of 32"
  kickoff="Sat Jun 27 · 15:00 ET"
  status="live"
  minute={67}
  accent="city-philadelphia"
  home={{ name: "Brazil", code: "BRA", score: 2, flag: "🇧🇷" }}
  away={{ name: "Croatia", code: "CRO", score: 1, flag: "🇭🇷" }}
  pickedCode="BRA"
/>
```

Set `pickedCode` and `pointsEarned` to surface the user's prediction state at the foot of the card.
