Text input. Use `variant="pill"` for the chat composer (which carries a Send button as `suffix`).

```jsx
<Input placeholder="you@example.com" type="email" />
<Input variant="pill" placeholder="Message your pool…" suffix={<Button size="sm">Send</Button>} />
<Input prefix={<span>#</span>} placeholder="Join code" />
```
