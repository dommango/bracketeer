// The display label shown on PUBLIC challenge boards. Must never fall back to a
// user's email (which would publish it to unauthenticated visitors). Prefer the
// user's chosen name; otherwise a stable, anonymous handle derived from their id.

import { createHash } from "node:crypto";

// A stable, non-reversible handle like "Player-3f9a2c" — same user → same handle.
export function anonHandle(userId: string): string {
  const h = createHash("sha256").update(userId).digest("hex").slice(0, 6);
  return `Player-${h}`;
}

// Resolve a safe public label: a trimmed real name if present, else an anonymous
// handle. Any name containing "@" is rejected (not just a full email address), so
// an email substring embedded in a name — e.g. "bob (bob@x.com)" — can never reach
// a public board.
export function publicLabel(rawName: string | null | undefined, userId: string): string {
  const name = (rawName ?? "").trim();
  if (name && !name.includes("@")) return name;
  return anonHandle(userId);
}
