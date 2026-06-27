// Pure navigation helpers for the public challenge shell — kept free of React so
// the routing rules (which tabs are shared, how the two games map onto one
// another, which game the unified Picks surface resolves to) are unit-testable.

import { featuredGame } from "@/lib/pool/games";

export type GameSlug = "md3" | "knockout";

// The challenge segment immediately after /challenge ("md3" | "knockout"), or
// null on the bare /challenge index and the unified /challenge/picks surface
// (neither sits on a single game tree).
export function challengeBaseFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/challenge\/(md3|knockout)(?:\/|$)/);
  return m ? `/challenge/${m[1]}` : null;
}

// Tab families shared by both games, keyed by the path suffix after the game
// base. Switching games on one of these keeps you on the same tab; everything
// else (/play, /u/<id>, /matches/<no>) is game-specific and falls back to the
// target's home, since the ids don't carry across games.
const SHARED_SUFFIXES = new Set(["", "/leaderboard", "/matches"]);

// The href that switches to `target` from wherever you are, preserving the tab
// family when it exists in both games and falling back to the target home
// otherwise (or when you're not on a game tree at all).
export function switchGameHref(pathname: string, target: GameSlug): string {
  const base = `/challenge/${target}`;
  const current = challengeBaseFromPath(pathname);
  if (!current) return base;
  const suffix = pathname.slice(current.length);
  return SHARED_SUFFIXES.has(suffix) ? `${base}${suffix}` : base;
}

// On the unified /challenge/picks surface there's no game segment, so the bottom
// nav's sibling tabs (home/leaderboard/matches) need a concrete game tree to
// point at. Use the featured game, defaulting to md3.
export function unifiedPicksBase(now: Date = new Date()): string {
  return featuredGame(now) === "KNOCKOUT" ? "/challenge/knockout" : "/challenge/md3";
}
