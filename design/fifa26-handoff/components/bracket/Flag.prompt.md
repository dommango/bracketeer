A real country flag — SVG, served from `flagcdn.com` by default. Defaults to a square clipped to a soft radius; pass `shape="circle"` for an avatar chip or `shape="rect"` for the natural 4:3 ratio.

```jsx
<Flag code="BRA" size={28} />
<Flag code="ARG" size={20} shape="circle" bordered />
<Flag code="ENG" shape="rect" />
```

Substitution note: the flag SVGs are pulled from the public `flagcdn.com` CDN. Self-host (`src={iso2 => '/flags/' + iso2 + '.svg'}`) if you need an offline-safe build.
