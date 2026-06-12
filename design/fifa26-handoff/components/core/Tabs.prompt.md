Horizontal tab strip. `pill` (default) is the sticky in-app navigator used inside pool views; `underline` is the quieter dashboard-style row.

```jsx
<Tabs
  items={[["leaderboard","Leaderboard"], ["bracket","Bracket"], ["chat","Chat"]]}
  value={tab}
  onChange={setTab}
/>
```
