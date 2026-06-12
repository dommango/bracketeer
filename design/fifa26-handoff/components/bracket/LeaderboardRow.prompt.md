A row in the pool leaderboard. Top-3 get medal glyphs; rank 1 gets a gold ring. Show `projected` to surface the live-points delta in real time during matches.

```jsx
<LeaderboardRow
  rank={1}
  label="Dom"
  initials="DM"
  avatarColor="city-houston"
  total={84}
  projected={3}
  isLeader
  breakdown={[
    { label: "Groups", value: 36 },
    { label: "R32",    value: 12 },
    { label: "R16",    value: 16 },
  ]}
/>
```
