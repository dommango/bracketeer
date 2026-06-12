The base surface. `brand` is the pitch-green hero block used on home + pool headers. `raised` floats above the page; `sunk` recedes; `dashed` is for empty states.

```jsx
<Card variant="brand" radius="2xl" padding="lg">…hero copy…</Card>
<Card variant="raised" padding="md">…leaderboard row…</Card>
<Card variant="dashed" padding="lg">No messages yet.</Card>
```

The `accent` prop tints a 4px left edge with any host-city token (e.g. `accent="city-philadelphia"`) — handy for tagging cards by group or user.
