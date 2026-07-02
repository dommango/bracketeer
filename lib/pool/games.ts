// Single source of truth for game-facing copy and a pure, time-derived phase for
// each game format. Every hub / create / pool surface that needs to describe a
// game or its current state reads from here, so the three games' stories can't
// drift across ~10 files. Pure and dependency-light: it wraps the fixed schedule
// constants (lib/scoring/schedule, lib/pool/knockout, lib/pool/match-day-3) and
// never touches the DB. The one thing it can't know purely — whether the
// full-bracket tournament has actually started — stays gated by the DB-backed
// hasTournamentStarted() at the call site, exactly as before.

import type { PoolFormat } from "@/lib/pool/manage";
import { KNOCKOUT_PICKS_OPEN_UTC } from "@/lib/pool/knockout";
import { firstMd3Kickoff, lastMd3Kickoff } from "@/lib/pool/match-day-3";
import { firstKnockoutKickoff, lastKnockoutKickoff } from "@/lib/games/daily-pickem/schedule";
import { kickoffFor } from "@/lib/scoring/schedule";
import { DISPLAY_TZ } from "@/lib/tz";
import { PRIZES, isChallengeFormat } from "@/lib/challenge/prizes-config";
import { formatPrize } from "@/lib/challenge/format-prize";

export interface GameCatalogEntry {
  // The game's display name as a closed/private pool (e.g. "Knockout Stage Pool").
  // Undefined for formats that only exist as a public challenge (Match Day Pickem).
  poolName?: string;
  // The game's display name as a public challenge (e.g. "Knockout Challenge").
  // Undefined for formats with no public challenge (Full Tournament Pool).
  challengeName?: string;
  // A one-line hook shown under the name on cards / banners.
  tagline: string;
  // A fuller description for the create page + card body.
  blurb: string;
  // A terse scoring summary line.
  scoringSummary: string;
}

// Every user-facing game string in one place. The same KNOCKOUT format reads as a
// "Knockout Stage Pool" when it's a private pool and a "Knockout Challenge" on the
// public board, so names are split by context (poolName / challengeName). Pulled
// from copy previously inlined across CreatePoolForm, create/page, KnockoutNotice,
// the challenge pages and the prize resolver so those surfaces can't drift.
export const GAME_CATALOG: Record<PoolFormat, GameCatalogEntry> = {
  MATCH_DAY_3_PICKEM: {
    challengeName: "Match Day Pickem",
    tagline: "Predict the scoreline of every knockout match — free to play.",
    blurb:
      "Predict the exact scoreline of every knockout match, round by round. Each pick locks at its own kickoff and the next round opens as its teams are decided. Later rounds are worth more (R32 ×1 → Final ×16), so comebacks stay alive to the Final. Free to play — no prize, just bragging rights.",
    scoringSummary:
      "Exact score 5 · right result & goal difference 3 · right result 1 · +1 correct advancer — then ×round (R32 ×1 → Final ×16).",
  },
  KNOCKOUT: {
    poolName: "Knockout Stage Pool",
    challengeName: "Knockout Challenge",
    tagline: "Create & invite now — picks open when the last 32 are set.",
    blurb:
      "Predict the knockout bracket against your friends. Create your pool and invite everyone now with the join code — picks open once the group stage wraps and the last 32 are set, then lock at the Round of 32 kickoff.",
    scoringSummary: "Round of 32 1 · R16 2 · QF 3 · SF 4 · Final 5.",
  },
  FULL_BRACKET: {
    poolName: "Full Tournament Pool",
    tagline: "The full tournament — group stage through the final.",
    blurb:
      "The full tournament — group stage through the final. Import or fill out the whole bracket. Only creatable before the group stage kicks off.",
    scoringSummary: "Group, third-place, and every knockout round are scored.",
  },
};

// Phases a game moves through over its lifecycle. UPCOMING = not yet creatable or
// open; CREATE_ONLY = you can create/invite but picks are gated shut (knockout
// before the field is set); PICKS_OPEN / PICKS_CLOSING = picks editable, the
// latter once the first lock has passed; LOCKED_LIVE = all picks locked, game
// playing out; COMPLETE = nothing left to do.
export type GamePhase =
  | "UPCOMING"
  | "CREATE_ONLY"
  | "PICKS_OPEN"
  | "PICKS_CLOSING"
  | "LOCKED_LIVE"
  | "COMPLETE";

export interface GameState {
  phase: GamePhase;
  // A short human label for the phase (badge / state line text).
  label: string;
  // The next meaningful deadline (first lock, lock, or open time), or null.
  deadline: Date | null;
  // Whether a new pool of this format can be created right now. For FULL_BRACKET
  // this is only an upper bound — the caller still AND-gates on the DB-backed
  // hasTournamentStarted(); see module header.
  creatable: boolean;
  // Whether the game accepts new joiners with something still to play for.
  joinable: boolean;
}

// Fixed schedule anchors, derived once. The Match Day Pickem (now the knockout
// daily pick'em) opens at the Round-of-32 kickoff (its first scored fixture) and
// runs until the Final kicks off; knockout-bracket open is the fixed constant and
// its lock is the Round-of-32 kickoff (match 73).
const KO_PICKEM_FIRST = firstKnockoutKickoff() ?? new Date(KNOCKOUT_PICKS_OPEN_UTC);
const KO_PICKEM_LAST =
  lastKnockoutKickoff() ?? kickoffFor(104) ?? new Date("2026-07-19T19:00:00Z");
const KNOCKOUT_OPEN = new Date(KNOCKOUT_PICKS_OPEN_UTC);
const KNOCKOUT_LOCK = kickoffFor(73) ?? new Date(KNOCKOUT_PICKS_OPEN_UTC);
const FULL_START = kickoffFor(1) ?? new Date("2026-06-11T19:00:00Z");

// Every game is COMPLETE a settle-window after the Final's kickoff (match over,
// results propagated) — without this each "live" phase lasted forever, so
// surfaces kept advertising finished games as live. 6h ≈ match length + ET/pens
// + feed lag. (All three formats end with the Final: the pick'em locks at its
// kickoff, the brackets score it.)
const SETTLE_MS = 6 * 3_600_000;
const TOURNAMENT_COMPLETE = new Date(KO_PICKEM_LAST.getTime() + SETTLE_MS);

const COMPLETE_STATE: GameState = {
  phase: "COMPLETE",
  label: "Complete",
  deadline: null,
  creatable: false,
  joinable: false,
};

// Pure, time-derived phase for a game. No DB — every boundary is a fixed instant.
export function resolveGamePhase(format: PoolFormat, now: Date = new Date()): GameState {
  const t = now.getTime();

  if (format === "MATCH_DAY_3_PICKEM") {
    // The knockout daily pick'em: open now until the Round of 32 kicks off, then
    // "live" (rounds keep opening as teams are decided) until the Final kickoff.
    if (t < KO_PICKEM_FIRST.getTime()) {
      return {
        phase: "PICKS_OPEN",
        label: "Open now",
        deadline: KO_PICKEM_FIRST,
        creatable: true,
        joinable: true,
      };
    }
    if (t < KO_PICKEM_LAST.getTime()) {
      return {
        phase: "PICKS_CLOSING",
        label: "Live — pick each round",
        deadline: KO_PICKEM_LAST,
        creatable: true,
        joinable: true,
      };
    }
    if (t >= TOURNAMENT_COMPLETE.getTime()) return COMPLETE_STATE;
    return {
      phase: "LOCKED_LIVE",
      label: "Locked · live",
      deadline: null,
      creatable: false,
      joinable: false,
    };
  }

  if (format === "KNOCKOUT") {
    if (t < KNOCKOUT_OPEN.getTime()) {
      return {
        phase: "CREATE_ONLY",
        // Picks open progressively as group results land (provisional seeding),
        // so this isn't a hard "opens Jun 28" gate any more — the bracket fills in.
        label: "Picks opening",
        deadline: KNOCKOUT_OPEN,
        creatable: true,
        joinable: true,
      };
    }
    if (t < KNOCKOUT_LOCK.getTime()) {
      return {
        phase: "PICKS_OPEN",
        label: "Picks open",
        deadline: KNOCKOUT_LOCK,
        creatable: true,
        joinable: true,
      };
    }
    if (t >= TOURNAMENT_COMPLETE.getTime()) return COMPLETE_STATE;
    return {
      phase: "LOCKED_LIVE",
      label: "Locked · live",
      deadline: null,
      creatable: false,
      joinable: false,
    };
  }

  // FULL_BRACKET: creatable only before the group stage kicks off; after that it's
  // locked and live. (creatable here is the time upper bound; the caller still
  // confirms via hasTournamentStarted().)
  if (t < FULL_START.getTime()) {
    return {
      phase: "UPCOMING",
      label: "Picks open",
      deadline: FULL_START,
      creatable: true,
      joinable: true,
    };
  }
  if (t >= TOURNAMENT_COMPLETE.getTime()) return COMPLETE_STATE;
  return {
    phase: "LOCKED_LIVE",
    label: "Locked · live",
    deadline: null,
    creatable: false,
    joinable: false,
  };
}

// Which single game the hub should spotlight right now, or null when there's
// nothing to promote (everything is live / leaderboards-only). The Knockout
// Challenge bracket leads while its picks are open — it locks entirely at the
// Round-of-32 kickoff, so its window is brief and time-sensitive. Otherwise the
// long-running knockout Match Day Pickem leads while it's still joinable (through
// the knockout rounds, until the Final kicks off).
export function featuredGame(now: Date = new Date()): PoolFormat | null {
  if (resolveGamePhase("KNOCKOUT", now).phase === "PICKS_OPEN") return "KNOCKOUT";
  if (resolveGamePhase("MATCH_DAY_3_PICKEM", now).joinable) return "MATCH_DAY_3_PICKEM";
  return null;
}

// The headline prize teaser for a challenge format. Null for formats without a
// prize (the amount/award itself lives in PRIZES; copy stays deliberately generic).
export function prizeTeaser(format: PoolFormat): string | null {
  // The Match Day Pickem is now the free knockout pick'em — no prize to advertise.
  if (format === "MATCH_DAY_3_PICKEM") return null;
  if (!isChallengeFormat(format)) return null;
  const prize = PRIZES[format];
  // Scaled prizes advertise the guaranteed floor ("$50+") so we never over-promise
  // a value that depends on the final entrant count; fixed prizes show their figure.
  if (prize.kind === "scaled") {
    return `Top the challenge — win a ${formatPrize(prize.min, prize.currency)}+ gift card (grows with entries).`;
  }
  return `Top the challenge — win ${prize.description}.`;
}

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: DISPLAY_TZ,
});

function dayLabel(d: Date): string {
  return MONTH_DAY.format(d); // e.g. "June 24"
}

// A kickoff's calendar month/day in the app's display timezone (Eastern). The
// late fixtures kick off past midnight UTC, so a UTC framing put the last MD3
// group fixture on "June 28" when everyone experiences it as the June 27 night
// game — every other match surface labels dates in DISPLAY_TZ.
function monthDayInDisplayTz(d: Date): { month: string; day: number } {
  const parts = MONTH_DAY.formatToParts(d);
  return {
    month: parts.find((p) => p.type === "month")?.value ?? "",
    day: Number(parts.find((p) => p.type === "day")?.value ?? 0),
  };
}

// The calendar span of the Match Day Pickem fixtures (first → last kickoff), for
// copy that tells players which games they're predicting and when. UTC-framed to
// match the rest of this module's date labels (gameStateLine). Same-month spans
// collapse the second month, e.g. "June 24–27"; cross-month stays "June 24 – July 2".
export function md3DateRange(): string {
  return spanLabel(firstMd3Kickoff(), lastMd3Kickoff());
}

// The calendar span of the knockout Match Day Pickem (Round of 32 → Final), for the
// promo card / hero copy. Same UTC framing as md3DateRange.
export function koPickemDateRange(): string {
  const first = firstKnockoutKickoff();
  const last = lastKnockoutKickoff();
  if (!first || !last) return "";
  return spanLabel(first, last);
}

// Collapse a first→last span into a compact label, framed in DISPLAY_TZ. Same-day
// → one date; same-month → "June 24–27"; cross-month → "June 28 – July 19".
function spanLabel(first: Date, last: Date): string {
  const a = monthDayInDisplayTz(first);
  const b = monthDayInDisplayTz(last);
  if (a.month === b.month && a.day === b.day) {
    return `${a.month} ${a.day}`;
  }
  if (a.month === b.month) {
    return `${a.month} ${a.day}–${b.day}`;
  }
  return `${a.month} ${a.day} – ${b.month} ${b.day}`;
}

// A short, friendly state line for a game card / badge, derived from the phase.
// Single source so the create card, create-success copy and the pool notice can't
// drift. Examples: "Open now · first pick locks 24 Jun",
// "Create & invite now · picks open 28 Jun", "Closed — group stage kicked off".
export function gameStateLine(format: PoolFormat, now: Date = new Date()): string {
  const state = resolveGamePhase(format, now);

  if (format === "MATCH_DAY_3_PICKEM") {
    switch (state.phase) {
      case "PICKS_OPEN":
      case "PICKS_CLOSING":
        return "Open now · each match locks at kickoff";
      default:
        return "Closed — the knockout pick'em has finished";
    }
  }

  if (format === "KNOCKOUT") {
    switch (state.phase) {
      case "CREATE_ONLY":
        return state.deadline
          ? `Create & invite now · picks open ${dayLabel(state.deadline)}`
          : "Create & invite now · picks open at the draw";
      case "PICKS_OPEN":
        return "Picks open now · lock at the Round of 32 kickoff";
      default:
        return "Locked — the Round of 32 has kicked off";
    }
  }

  // FULL_BRACKET
  return state.phase === "UPCOMING"
    ? "Open now · locks at kickoff"
    : "Closed — the group stage has kicked off";
}
